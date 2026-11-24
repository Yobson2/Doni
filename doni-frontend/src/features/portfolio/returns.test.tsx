// @vitest-environment jsdom
import i18n from '@/i18n'
import { fakeApi, json, session } from '@/test/fake-api'
import { renderApp } from '@/test/render-app'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

// The chart library draws on a canvas, which jsdom lacks: record the data
// the page hands to each series instead.
const chart = vi.hoisted(() => ({ series: [] as unknown[][] }))
vi.mock('lightweight-charts', () => ({
  LineSeries: 'LineSeries',
  LineStyle: { Dashed: 2 },
  createChart: () => ({
    addSeries: () => ({
      setData: (data: unknown[]) => {
        chart.series.push(data)
      },
    }),
    timeScale: () => ({ fitContent: () => {} }),
    remove: () => {},
  }),
}))

const PORTFOLIO_ID = '0b7f8a52-4a3e-4d0e-9d56-2f6b1c7e9a01'
const portfolio = {
  id: PORTFOLIO_ID,
  name: 'Mon portefeuille',
  createdAt: '2026-01-05T10:00:00.000Z',
}
const RETURNS = `GET /api/portfolios/${PORTFOLIO_ID}/returns`
const emptyValuation = {
  portfolio,
  positions: [],
  totals: {
    costBasis: '0',
    realisedGain: '0',
    marketValue: '0',
    unrealisedGain: '0',
    dividends: '0',
    totalGain: '0',
  },
  performanceSince: '2026-11-09',
  allocation: { marketValue: '0', bySecurity: [], bySector: [], unpriced: [] },
}

// As the API returns them for the e2e case: 10 SNTS bought on 2026-11-09;
// SNTS's price is missing on 2026-11-12, the index value on 2026-11-13.
const returns = {
  period: 'ALL',
  from: '2026-11-09',
  to: '2026-11-13',
  xirr: {
    method: 'xirr',
    annualised: true,
    status: 'solved',
    percent: '475.78',
  },
  comparison: {
    method: 'twr',
    benchmark: { code: 'BRVM-C', name: 'BRVM Composite' },
    points: [
      { date: '2026-11-09', portfolio: '0.00', benchmark: '0.00' },
      { date: '2026-11-10', portfolio: '-3.61', benchmark: '-1.74' },
      { date: '2026-11-11', portfolio: '0.96', benchmark: '-0.90' },
      { date: '2026-11-12', portfolio: null, benchmark: '-0.36' },
      { date: '2026-11-13', portfolio: '0.00', benchmark: null },
    ],
  },
  gaps: [
    { date: '2026-11-12', benchmark: false, tickers: ['SNTS'] },
    { date: '2026-11-13', benchmark: true, tickers: [] },
  ],
}

const returnsApi = (body: object = returns) =>
  fakeApi({
    'POST /api/auth/refresh': () => session('token'),
    'GET /api/portfolios': () => json(200, [portfolio]),
    [`GET /api/portfolios/${PORTFOLIO_ID}/valuation`]: () =>
      json(200, emptyValuation),
    [`GET /api/portfolios/${PORTFOLIO_ID}/entries`]: () => json(200, []),
    [`GET /api/portfolios/${PORTFOLIO_ID}/dividends`]: () => json(200, []),
    [RETURNS]: () => json(200, body),
  })

const text = (s: string | null | undefined) => s?.replace(/\s/g, ' ')

describe('portfolio returns', () => {
  beforeEach(async () => {
    useAuthStore.getState().auth.reset()
    chart.series = []
    await i18n.changeLanguage('fr')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows Mon rendement with its method and period', async () => {
    returnsApi()
    renderApp('/portfolio')

    const card = (
      await screen.findByRole('heading', { name: 'Mon rendement' })
    ).closest('[data-slot="card"]') as HTMLElement
    const content = text(card.textContent)
    expect(content).toContain('+475,78 % par an')
    expect(content).toContain('XIRR, pondéré par les capitaux, annualisé')
    expect(content).toContain('Du 9 novembre 2026 au 13 novembre 2026')
  })

  it('compares the portfolio TWR with the BRVM Composite, labelled with method and period', async () => {
    returnsApi()
    renderApp('/portfolio')

    const card = (
      await screen.findByRole('heading', {
        name: 'Comparaison avec le BRVM Composite',
      })
    ).closest('[data-slot="card"]') as HTMLElement
    const content = text(card.textContent)
    expect(content).toContain('TWR, pondéré par le temps')
    expect(content).toContain('Du 9 novembre 2026 au 13 novembre 2026')
    // Each series' latest value, with the day it applies to.
    expect(content).toContain(
      'Mon portefeuille (TWR)0,00 % au 13 novembre 2026'
    )
    expect(content).toContain('BRVM Composite-0,36 % au 12 novembre 2026')
    expect(
      screen.getByRole('img', {
        name: 'Rendement cumulé de votre portefeuille (TWR) et du BRVM Composite, du 9 novembre 2026 au 13 novembre 2026',
      })
    ).toBeTruthy()
  })

  it('says which data is missing and breaks the lines there instead of interpolating', async () => {
    returnsApi()
    renderApp('/portfolio')

    const notice = await screen.findByRole('alert')
    expect(text(notice.textContent)).toContain('Données manquantes')
    expect(text(notice.textContent)).toContain(
      '12 novembre 2026 : pas de cours de clôture pour SNTS'
    )
    expect(text(notice.textContent)).toContain(
      '13 novembre 2026 : pas de valeur du BRVM Composite'
    )

    // Benchmark first, then the portfolio. A missing day is a whitespace
    // point (a break in the line), never a made-up value.
    await waitFor(() => expect(chart.series).toHaveLength(2))
    const [benchmark, portfolioLine] = chart.series
    expect(benchmark[4]).toEqual({ time: '2026-11-13' })
    expect(portfolioLine[3]).toEqual({ time: '2026-11-12' })
    expect(portfolioLine[2]).toEqual({ time: '2026-11-11', value: 0.96 })
  })

  it('shows no notice when no data is missing', async () => {
    returnsApi({ ...returns, gaps: [] })
    renderApp('/portfolio')

    await screen.findByRole('heading', { name: 'Mon rendement' })
    expect(screen.queryByText('Données manquantes')).toBeNull()
  })

  it('asks the API for the period chosen', async () => {
    const { requests } = returnsApi()
    renderApp('/portfolio')

    fireEvent.click(await screen.findByRole('button', { name: '1 an' }))

    await waitFor(() =>
      expect(requests.some((r) => r.url.endsWith('/returns?period=1Y'))).toBe(
        true
      )
    )
    expect(
      screen.getByRole('button', { name: '1 an' }).getAttribute('aria-pressed')
    ).toBe('true')
  })

  it('explains why the XIRR cannot be computed', async () => {
    returnsApi({
      ...returns,
      xirr: { ...returns.xirr, status: 'unpriced', percent: null },
    })
    renderApp('/portfolio')

    expect(
      await screen.findByText(
        'Incalculable : une valeur détenue n’a pas de cours de clôture publié au début ou à la fin de la période.'
      )
    ).toBeTruthy()
  })

  it('is in English too', async () => {
    await i18n.changeLanguage('en')
    returnsApi()
    renderApp('/portfolio')

    expect(
      await screen.findByRole('heading', { name: 'My return' })
    ).toBeTruthy()
    const notice = await screen.findByRole('alert')
    expect(text(notice.textContent)).toContain(
      'November 12, 2026: no closing price for SNTS'
    )
  })
})
