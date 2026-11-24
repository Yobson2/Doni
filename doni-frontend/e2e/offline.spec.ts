/* eslint-disable no-console -- temporary CI diagnostics */
import { expect, test, type Page } from '@playwright/test'

const API = 'http://localhost:3999'

/** Waits until the service worker controls the page (shell precached). */
async function serviceWorkerInControl(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
}

/** Waits until the query cache, with the portfolio, is saved to IndexedDB. */
async function cacheSaved(page: Page) {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('keyval-store')
        open.onerror = () => resolve(false)
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains('keyval')) return resolve(false)
          const get = db
            .transaction('keyval')
            .objectStore('keyval')
            .get('doni-query-cache')
          get.onsuccess = () =>
            resolve(String(get.result ?? '').includes('valuation'))
          get.onerror = () => resolve(false)
        }
      }),
    undefined,
    { polling: 250 }
  )
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
  const dump = () =>
    page.evaluate(
      () =>
        new Promise((res) => {
          const o = indexedDB.open('keyval-store')
          o.onsuccess = () => {
            const g = o.result
              .transaction('keyval')
              .objectStore('keyval')
              .get('doni-query-cache')
            g.onsuccess = () => {
              if (!g.result) return res('none')
              const c = JSON.parse(g.result)
              res(
                JSON.stringify({
                  ts: c.timestamp,
                  now: Date.now(),
                  b: c.buster,
                  q: c.clientState.queries.map(
                    (q: { queryHash: string; state: { status: string } }) =>
                      q.queryHash + ':' + q.state.status
                  ),
                })
              )
            }
          }
        })
    )
  console.log('DIAG before', await dump())
  page.on('console', (m) => console.log('DIAG console', m.type(), m.text()))

  // The connection drops: the browser is offline and the API unreachable.
  await request.post(`${API}/__down`)
  await context.setOffline(true)
  await page.reload()
  await page.waitForTimeout(3000)
  console.log('DIAG after', await dump())
  console.log('DIAG url', page.url())

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
