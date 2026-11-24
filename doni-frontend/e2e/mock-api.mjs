/**
 * A stand-in for the Doni API in the offline e2e test: answers the reads the
 * portfolio page makes with fixed data. `POST /__down` makes it refuse every
 * request (connections are dropped), like a server out of reach, until
 * `POST /__up`; together
 * with Playwright's offline mode this guarantees nothing reaches the network.
 *
 *   node e2e/mock-api.mjs   (port from MOCK_API_PORT, default 3999)
 */
import { createServer } from 'node:http'

const port = Number(process.env.MOCK_API_PORT ?? 3999)

const user = {
  id: '6f1c2b8e-1d2a-4c55-9a8e-2b9f0d6f7a10',
  email: 'awa@example.com',
  firstName: null,
  lastName: null,
  role: 'MEMBRE',
  isActive: true,
  displayCurrency: 'XOF',
  createdAt: '2026-01-05T10:00:00.000Z',
  updatedAt: '2026-01-05T10:00:00.000Z',
}
const portfolio = {
  id: '0b7f8a52-4a3e-4d0e-9d56-2f6b1c7e9a01',
  name: 'Portefeuille de test',
  createdAt: '2026-01-05T10:00:00.000Z',
}
const valuation = {
  portfolio,
  positions: [
    {
      ticker: 'SNTS',
      name: 'SONATEL',
      quantity: '90',
      pmp: '4120.5',
      costBasis: '370845',
      realisedGain: '21420',
      dividends: '14940',
      valuation: {
        price: '4190',
        priceDate: '2026-11-11',
        marketValue: '377100',
        unrealisedGain: '6255',
      },
    },
  ],
  totals: {
    costBasis: '370845',
    realisedGain: '21420',
    marketValue: '377100',
    unrealisedGain: '6255',
    dividends: '14940',
    totalGain: '42615',
  },
  performanceSince: '2026-01-05',
  allocation: {
    marketValue: '377100',
    bySecurity: [
      { ticker: 'SNTS', name: 'SONATEL', marketValue: '377100', percent: '100.0' },
    ],
    bySector: [
      {
        code: 'TEL',
        nameFr: 'Télécommunications',
        nameEn: 'Telecoms',
        marketValue: '377100',
        percent: '100.0',
      },
    ],
    unpriced: [],
  },
}
const entries = [
  {
    id: 'e1',
    kind: 'buy',
    ticker: 'SNTS',
    securityName: 'SONATEL',
    date: '2026-01-05',
    quantity: '100',
    price: '4000',
    fees: '2000',
    sgi: 'SGI Test Bourse',
    recordedAt: '2026-01-05T10:00:00.000Z',
  },
]
const securities = [
  {
    ticker: 'SNTS',
    name: 'SONATEL',
    isin: null,
    sector: { code: 'TEL', nameFr: 'Télécommunications', nameEn: 'Telecoms' },
    country: 'SN',
    profileFr: null,
    profileEn: null,
    profileOriginalLanguage: 'fr',
    latestPrice: {
      date: '2026-11-11',
      close: '4190',
      open: null,
      high: null,
      low: null,
      volume: null,
      sourceDocument: 'BOC 2026-11-11',
    },
  },
]

const p = `/api/portfolios/${portfolio.id}`
const routes = {
  'POST /api/auth/refresh': () => ({ accessToken: 'e2e', expiresIn: 900, user }),
  'POST /api/auth/sign-out': () => undefined,
  'GET /api/users/me': () => user,
  'GET /api/portfolios': () => [portfolio],
  [`GET ${p}/valuation`]: () => valuation,
  [`GET ${p}/entries`]: () => entries,
  [`GET ${p}/dividends`]: () => [],
  'GET /api/securities': () => securities,
  'GET /api/watchlist': () => [],
}

let down = false

createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  if (path === '/__down' || path === '/__up') {
    down = path === '/__down'
    res.writeHead(204).end()
    return
  }
  if (down) {
    req.socket.destroy()
    return
  }
  const route = routes[`${req.method} ${path}`]
  if (!route) {
    res.writeHead(404).end()
    return
  }
  const body = route()
  if (body === undefined) {
    res.writeHead(204).end()
    return
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}).listen(port, () => console.log(`mock API on http://localhost:${port}`))
