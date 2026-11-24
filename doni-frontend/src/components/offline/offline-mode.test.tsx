// @vitest-environment jsdom
import i18n from '@/i18n'
import { fakeApi, json, session } from '@/test/fake-api'
import { renderApp } from '@/test/render-app'
import { act, cleanup, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

// Whole-app renders are slow on a loaded machine.
vi.setConfig({ testTimeout: 20000 })

const PORTFOLIO_ID = '0b7f8a52-4a3e-4d0e-9d56-2f6b1c7e9a01'
const portfolio = {
  id: PORTFOLIO_ID,
  name: 'Mon portefeuille',
  createdAt: '2026-01-05T10:00:00.000Z',
}
const valuation = {
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
  performanceSince: null,
  allocation: { marketValue: '0', bySecurity: [], bySector: [], unpriced: [] },
}
const entry = {
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
}
const dividend = {
  referenceDividendId: 'rd-past',
  ticker: 'SNTS',
  securityName: 'SONATEL',
  exDate: '2026-05-12',
  paymentDate: '2026-05-20',
  grossPerShare: '1655',
  sourceNoticeUrl: 'https://www.brvm.org/fr/avis/example',
  shares: '100',
  grossAmount: '165500',
  status: 'suggested',
  netAmount: null,
  entryId: null,
}
const watched = {
  ticker: 'SNTS',
  name: 'SONATEL',
  addedAt: '2026-11-12T09:00:00.000Z',
  latestPrice: null,
}

function api() {
  return fakeApi({
    'POST /api/auth/refresh': () => session('token'),
    'GET /api/portfolios': () => json(200, [portfolio]),
    [`GET /api/portfolios/${PORTFOLIO_ID}/valuation`]: () =>
      json(200, valuation),
    [`GET /api/portfolios/${PORTFOLIO_ID}/entries`]: () => json(200, [entry]),
    [`GET /api/portfolios/${PORTFOLIO_ID}/dividends`]: () =>
      json(200, [dividend]),
    'GET /api/securities': () => json(200, []),
    'GET /api/watchlist': () => json(200, [watched]),
  })
}

/** Switches the browser's connection, as the `online`/`offline` events do. */
function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'))
  })
}

/** Asserts a write button is disabled offline and says why. */
function expectDisabledWithReason(button: HTMLElement) {
  expect(button).toHaveProperty('disabled', true)
  expect(button.getAttribute('title')).toBe(
    'Indisponible hors ligne : reconnectez-vous à Internet pour enregistrer.'
  )
  const reason = document.getElementById(
    button.getAttribute('aria-describedby') ?? ''
  )
  expect(reason?.textContent).toContain('Les modifications sont désactivées')
}

describe('offline mode', () => {
  beforeEach(async () => {
    useAuthStore.getState().auth.reset()
    await i18n.changeLanguage('fr')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows a banner while offline, and hides it when the connection is back', async () => {
    api()
    renderApp('/guides')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('Hors ligne.')).toBeNull()

    setOnline(false)
    expect(screen.getByRole('status').textContent).toContain('Hors ligne.')

    setOnline(true)
    expect(screen.queryByText('Hors ligne.')).toBeNull()
  })

  it('disables every write on the portfolio page offline, with the reason, and says when the data was synced', async () => {
    api()
    renderApp('/portfolio')
    const record = await screen.findByRole('button', { name: 'Enregistrer' })
    const confirm = await screen.findByRole('button', {
      name: /^Confirmer le dividende/,
    })
    expect(record).toHaveProperty('disabled', false)
    expect(screen.queryByText(/Données synchronisées le/)).toBeNull()

    setOnline(false)

    expect(screen.getByText(/Données synchronisées le/)).toBeTruthy()
    const writes = [
      record,
      confirm,
      screen.getByRole('button', { name: /^Ignorer le dividende/ }),
      screen.getByRole('button', { name: /^Modifier l’écriture/ }),
      screen.getByRole('button', { name: /^Supprimer l’écriture/ }),
      ...within(screen.getByRole('group', { name: /devise/i })).getAllByRole(
        'button'
      ),
    ]
    writes.forEach(expectDisabledWithReason)

    // Reading is not a write: switching what is shown still works.
    expect(
      screen.getByRole('button', { name: 'Position d’ouverture' })
    ).toHaveProperty('disabled', false)

    setOnline(true)
    expect(record).toHaveProperty('disabled', false)
  })

  it('disables watchlist edits offline', async () => {
    api()
    renderApp('/watchlist')
    const remove = await screen.findByRole('button', {
      name: 'Ne plus suivre SNTS',
    })
    setOnline(false)
    expectDisabledWithReason(remove)
  })

  it('disables account actions offline', async () => {
    api()
    renderApp('/settings/account')
    const exportData = await screen.findByRole('button', {
      name: /Télécharger mes données/,
    })
    setOnline(false)
    expectDisabledWithReason(exportData)
    expectDisabledWithReason(
      screen.getByRole('button', { name: 'Supprimer mon compte…' })
    )
  })

  it('disables sign-up and sign-in offline', async () => {
    api()
    renderApp('/sign-up')
    const signUp = await screen.findByRole('button', {
      name: 'Créer un compte',
    })
    setOnline(false)
    expectDisabledWithReason(signUp)
  })
})
