// @vitest-environment jsdom
import i18n from '@/i18n'
import { fakeApi, json, session } from '@/test/fake-api'
import { renderApp } from '@/test/render-app'
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

// The company page draws its chart on a canvas, which jsdom does not have.
vi.mock('lightweight-charts', () => ({
  LineSeries: 'LineSeries',
  createChart: () => ({
    addSeries: () => ({ setData: () => {} }),
    applyOptions: () => {},
    timeScale: () => ({ fitContent: () => {} }),
    remove: () => {},
  }),
}))

const price = (close: string) => ({
  date: '2026-11-11',
  close,
  open: null,
  high: null,
  low: null,
  volume: null,
  sourceDocument: 'https://www.brvm.org/sites/default/files/boc_20261111_2.pdf',
  publishedOn: '2026-11-11',
})
const item = (ticker: string, name: string, close: string | null) => ({
  ticker,
  name,
  addedAt: '2026-11-12T09:00:00.000Z',
  latestPrice: close ? price(close) : null,
})
const sonatel = {
  ticker: 'SNTS',
  name: 'SONATEL',
  isin: null,
  sector: {
    code: 'TEL',
    nameFr: 'Télécommunications',
    nameEn: 'Telecommunications',
  },
  country: 'SN',
  profileFr: null,
  profileEn: null,
  profileOriginalLanguage: 'fr',
  latestPrice: price('4190'),
}

/** A fake API whose watchlist starts with `initial` and follows changes. */
function fakeWatchlistApi(initial: ReturnType<typeof item>[]) {
  let items = [...initial]
  const api = fakeApi({
    'POST /api/auth/refresh': () => session('token'),
    'GET /api/watchlist': () => json(200, items),
    'PUT /api/watchlist/SNTS': () => {
      const added = item('SNTS', 'SONATEL', '4190')
      items = [...items.filter((i) => i.ticker !== 'SNTS'), added]
      return json(200, added)
    },
    'DELETE /api/watchlist/SNTS': () => {
      items = items.filter((i) => i.ticker !== 'SNTS')
      return new Response(null, { status: 204 })
    },
    'GET /api/securities/SNTS': () => json(200, sonatel),
    'GET /api/securities/SNTS/prices': () => json(200, [price('4190')]),
  })
  return {
    ...api,
    calls: (method: string) =>
      api.requests.filter(
        (r) => r.method === method && r.url.includes('/api/watchlist/')
      ),
  }
}

describe('watchlist', () => {
  beforeEach(async () => {
    useAuthStore.getState().auth.reset()
    await i18n.changeLanguage('fr')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('lists watched securities with their latest end-of-day price and its date', async () => {
    fakeWatchlistApi([
      item('ORAC', 'ORANGE COTE D’IVOIRE', '20000'),
      item('SNTS', 'SONATEL', '4190'),
      item('NEW', 'Nouvelle cotation', null),
    ])
    renderApp('/watchlist')

    await screen.findByRole('heading', { level: 1, name: 'Ma liste de suivi' })
    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(rows[0].textContent).toMatch(/20\s000/)
    expect(rows[0].textContent).toContain('11/11/2026')
    expect(rows[1].textContent).toMatch(/4\s190/)
    // No published price yet: no figure, no date.
    expect(rows[2].textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('removes a security from the list', async () => {
    const api = fakeWatchlistApi([item('SNTS', 'SONATEL', '4190')])
    renderApp('/watchlist')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Ne plus suivre SNTS' })
    )

    expect(
      await screen.findByText('Vous ne suivez aucune valeur pour le moment.')
    ).toBeTruthy()
    expect(api.calls('DELETE')).toHaveLength(1)
  })

  it('is in the sidebar, in French and in English', async () => {
    fakeWatchlistApi([])
    renderApp('/watchlist')

    expect(
      await screen.findByRole('link', { name: 'Ma liste de suivi' })
    ).toBeTruthy()
    await i18n.changeLanguage('en')
    expect(
      await screen.findByRole('link', { name: 'My watchlist' })
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 1, name: 'My watchlist' })
    ).toBeTruthy()
  })

  it('adds and removes a security from its company page', async () => {
    const api = fakeWatchlistApi([])
    renderApp('/securities/SNTS')

    const watch = await screen.findByRole('button', { name: 'Suivre' })
    await waitFor(() => expect(watch.hasAttribute('disabled')).toBe(false))
    expect(watch.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(watch)

    const watching = await screen.findByRole('button', { name: 'Suivie' })
    await waitFor(() =>
      expect(watching.getAttribute('aria-pressed')).toBe('true')
    )
    expect(api.calls('PUT')).toHaveLength(1)

    await waitFor(() => expect(watching.hasAttribute('disabled')).toBe(false))
    fireEvent.click(watching)
    await screen.findByRole('button', { name: 'Suivre' })
    expect(api.calls('DELETE')).toHaveLength(1)
  })
})
