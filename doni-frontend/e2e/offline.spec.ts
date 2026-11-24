import { expect, test, type Page } from '@playwright/test'

const API = 'http://localhost:3999'

/** Waits until the service worker controls the page (shell precached). */
async function serviceWorkerInControl(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
}

/** The queries saved to IndexedDB for offline use, as "hash:status". */
function savedQueries(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const open = indexedDB.open('keyval-store')
        open.onerror = () => resolve([])
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains('keyval')) return resolve([])
          const get = db
            .transaction('keyval')
            .objectStore('keyval')
            .get('doni-query-cache')
          get.onerror = () => resolve([])
          get.onsuccess = () => {
            if (typeof get.result !== 'string') return resolve([])
            const saved = JSON.parse(get.result) as {
              clientState: {
                queries: { queryHash: string; state: { status: string } }[]
              }
            }
            resolve(
              saved.clientState.queries.map(
                (q) => `${q.queryHash}:${q.state.status}`
              )
            )
          }
        }
      })
  )
}

/**
 * Waits until the portfolio's queries are saved to IndexedDB. Saving is
 * throttled (1 s), so the first save may hold only the signed-in user.
 * (`page.evaluate` awaits the promise; `waitForFunction` would not, and would
 * pass at once on a fast machine.)
 */
async function cacheSaved(page: Page) {
  const portfolio = /^\["portfolios"\]:success$/
  const valuation = /^\["portfolios","[^"]+","valuation"\]:success$/
  await expect
    .poll(async () => {
      const saved = await savedQueries(page)
      return saved.some((q) => portfolio.test(q)) &&
        saved.some((q) => valuation.test(q))
    }, { timeout: 10_000 })
    .toBe(true)
}

test('after one visit, the portfolio and the guides work offline, read-only', async ({
  page,
  context,
  request,
}) => {
  // Online: one visit to the portfolio.
  await request.post(`${API}/__up`)
  await page.goto('/portfolio')
  await expect(
    page.getByRole('heading', { name: 'Portefeuille de test' })
  ).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Hors ligne' })).toHaveCount(0)
  await serviceWorkerInControl(page)
  await cacheSaved(page)

  // The connection drops: the browser is offline and the API unreachable.
  await request.post(`${API}/__down`)
  await context.setOffline(true)
  await page.reload()

  // The offline banner.
  const banner = page.getByRole('status').filter({ hasText: 'Hors ligne' })
  await expect(banner).toBeVisible()

  // The last synced portfolio, with its dates: when it was synced, and the
  // trading day its prices are from.
  await expect(
    page.getByRole('heading', { name: 'Portefeuille de test' })
  ).toBeVisible()
  await expect(page.getByText(/Données synchronisées le/)).toBeVisible()
  await expect(
    page.getByText('Cours de clôture au 11 novembre 2026')
  ).toBeVisible()
  await expect(page.getByRole('cell', { name: 'SNTS' }).first()).toBeVisible()

  // Writes are disabled, with the reason.
  const record = page.getByRole('button', { name: 'Enregistrer', exact: true })
  await expect(record).toBeDisabled()
  await expect(record).toHaveAttribute('title', /Indisponible hors ligne/)
  await expect(record).toHaveAccessibleDescription(/Hors ligne/)
  for (const button of await page
    .getByRole('button', { name: /^(Corriger|Supprimer) / })
    .all()) {
    await expect(button).toBeDisabled()
  }

  // A guide never opened before: its text ships in a precached chunk.
  await page.goto('/guides/brvm')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Qu’est-ce que la BRVM ?' })
      .or(page.getByRole('heading', { level: 1, name: "Qu'est-ce que la BRVM ?" }))
  ).toBeVisible()
  await expect(page.getByText(/Mis à jour le \d+ \S+ \d{4}/)).toBeVisible()
  await expect(banner).toBeVisible()

  await context.setOffline(false)
  await request.post(`${API}/__up`)
})
