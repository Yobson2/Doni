// @vitest-environment jsdom
import i18n from '@/i18n'
import { fakeApi, json, session } from '@/test/fake-api'
import { renderApp } from '@/test/render-app'
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

// The chart draws on a canvas, which jsdom does not have: record what the
// page hands to the chart library instead.
const chart = vi.hoisted(() => ({ data: [] as unknown[] }))
vi.mock('lightweight-charts', () => ({
  LineSeries: 'LineSeries',
  createChart: () => ({
    addSeries: () => ({
      setData: (data: unknown[]) => {
        chart.data = data
      },
    }),
    applyOptions: () => {},
    timeScale: () => ({ fitContent: () => {} }),
    remove: () => {},
  }),
}))

const BOC = (day: string) =>
  `https://www.brvm.org/sites/default/files/boc_202611${day}_2.pdf`

// SONATEL as the seed stores it (real BOC N° 213 to 215).
const price = (day: string, close: string) => ({
  date: `2026-11-${day}`,
  close,
  open: null,
  high: null,
  low: null,
  volume: null,
  sourceDocument: BOC(day),
  publishedOn: `2026-11-${day}`,
})
const history = [price('09', '4150'), price('10', '4000'), price('11', '4190')]
const sonatel = {
  ticker: 'SNTS',
  name: 'Société Nationale de Télécommunication du Sénégal (SONATEL)',
  isin: null,
  sector: {
    code: 'TEL',
    nameFr: 'Télécommunications',
    nameEn: 'Telecommunications',
  },
  country: 'SN',
  profileFr: 'Opérateur de télécommunications basé à Dakar.',
  profileEn: 'Telecommunications operator based in Dakar.',
  profileOriginalLanguage: 'fr',
  latestPrice: history[2],
}

async function openCompanyPage() {
  fakeApi({
    'POST /api/auth/refresh': () => session('token'),
    'GET /api/securities/SNTS': () => json(200, sonatel),
    'GET /api/securities/SNTS/prices': () => json(200, history),
  })
  renderApp('/securities/SNTS')
  return screen.findByRole('heading', { level: 1, name: /SONATEL/ })
}

describe('company page', () => {
  beforeEach(async () => {
    useAuthStore.getState().auth.reset()
    chart.data = []
    await i18n.changeLanguage('fr')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the price history of a seeded security', async () => {
    await openCompanyPage()

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    // Newest first in the table, each with the BOC it comes from.
    expect(rows[0].textContent).toContain('11/11/2026')
    expect(rows[0].textContent).toMatch(/4\s190/)
    expect(within(rows[0]).getByRole('link').getAttribute('href')).toBe(
      BOC('11')
    )

    // The chart gets every day, oldest first.
    expect(chart.data).toEqual([
      { time: '2026-11-09', value: 4150 },
      { time: '2026-11-10', value: 4000 },
      { time: '2026-11-11', value: 4190 },
    ])
  })

  it('labels the price as end-of-day, as of its date, never live', async () => {
    await openCompanyPage()

    const label = await screen.findByText(/Cours de clôture au/)
    expect(label.textContent).toContain('11 novembre 2026')
    expect(document.body.textContent).not.toMatch(/en direct|temps réel/i)

    await i18n.changeLanguage('en')
    expect(
      (await screen.findByText(/End-of-day price as of/)).textContent
    ).toContain('November 11, 2026')
    expect(document.body.textContent).not.toMatch(/\blive\b|real-time/i)
  })

  it('marks the translated profile as a translation', async () => {
    await openCompanyPage()

    expect(
      await screen.findByText('Opérateur de télécommunications basé à Dakar.')
    ).toBeTruthy()
    expect(screen.queryByText(/Tradui/)).toBeNull()

    await i18n.changeLanguage('en')
    expect(
      await screen.findByText('Telecommunications operator based in Dakar.')
    ).toBeTruthy()
    expect(screen.getByText('Translated from French')).toBeTruthy()
  })
})
