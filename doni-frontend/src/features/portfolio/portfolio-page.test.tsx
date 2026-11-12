// @vitest-environment jsdom
import i18n from '@/i18n'
import { fakeApi, json, session, testUser } from '@/test/fake-api'
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

const PORTFOLIO_ID = '0b7f8a52-4a3e-4d0e-9d56-2f6b1c7e9a01'
const portfolio = {
  id: PORTFOLIO_ID,
  name: 'Mon portefeuille',
  createdAt: '2026-01-05T10:00:00.000Z',
}
const VALUATION = `GET /api/portfolios/${PORTFOLIO_ID}/valuation`
const ENTRIES = `/api/portfolios/${PORTFOLIO_ID}/entries`

// The reference case of the ledger engine, as the API returns it.
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
  },
  performanceSince: '2026-01-05',
  allocation: {
    marketValue: '377100',
    bySecurity: [
      {
        ticker: 'SNTS',
        name: 'SONATEL',
        marketValue: '377100',
        percent: '100.0',
      },
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
    unpriced: [] as Array<{ ticker: string; name: string }>,
  },
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

const sonatel = {
  ticker: 'SNTS',
  name: 'SONATEL',
  isin: null,
  sector: { code: 'TEL', nameFr: 'Télécommunications', nameEn: 'Telecoms' },
  country: 'SN',
  profileFr: null,
  profileEn: null,
  profileOriginalLanguage: 'fr',
  latestPrice: null,
}

const portfolioApi = (routes = {}) =>
  fakeApi({
    'POST /api/auth/refresh': () => session('token'),
    'GET /api/portfolios': () => json(200, [portfolio]),
    [VALUATION]: () => json(200, valuation),
    [`GET ${ENTRIES}`]: () => json(200, [entry]),
    'GET /api/securities': () => json(200, [sonatel]),
    ...routes,
  })

// Intl separates thousands with a narrow no-break space in French.
const text = (s: string | null) => s?.replace(/\s/g, ' ')

describe('portfolio page', () => {
  beforeEach(async () => {
    useAuthStore.getState().auth.reset()
    await i18n.changeLanguage('fr')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows positions with PMP, market value, realised and unrealised gain, and the as-of date', async () => {
    portfolioApi()
    renderApp('/portfolio')

    await screen.findByRole('heading', { level: 1, name: 'Mon portefeuille' })
    const table = within(
      (await screen.findByRole('heading', { name: 'Positions' })).closest(
        '[data-slot="card"]'
      ) as HTMLElement
    )
    const row = text(table.getByText('SNTS').closest('tr')!.textContent)
    expect(row).toContain('90')
    expect(row).toContain('4 120,50 F CFA') // PMP
    expect(row).toContain('4 190 F CFA') // end-of-day price
    expect(row).toContain('au 11/11/2026') // its date
    expect(row).toContain('377 100 F CFA') // market value
    expect(row).toContain('+6 255 F CFA') // unrealised gain
    expect(row).toContain('+21 420 F CFA') // realised gain

    expect(
      screen.getByText('Cours de clôture au 11 novembre 2026')
    ).toBeTruthy()
    const summary = text(
      screen.getByRole('region', { name: 'Synthèse du portefeuille' })
        .textContent
    )
    expect(summary).toContain('Valeur de marché377 100 F CFA')
    expect(summary).toContain('Plus-value latente+6 255 F CFA')
    expect(summary).toContain('Plus-value réalisée+21 420 F CFA')
  })

  describe('allocation', () => {
    // Two priced positions and one without a closing price yet.
    const spread = {
      ...valuation,
      totals: { ...valuation.totals, marketValue: null, unrealisedGain: null },
      allocation: {
        marketValue: '1384500',
        bySecurity: [
          {
            ticker: 'SNTS',
            name: 'SONATEL',
            marketValue: '619000',
            percent: '44.7',
          },
          {
            ticker: 'SGBC',
            name: 'SGB CI',
            marketValue: '386000',
            percent: '27.9',
          },
          {
            ticker: 'PALC',
            name: 'PALM CI',
            marketValue: '379500',
            percent: '27.4',
          },
        ],
        bySector: [
          {
            code: 'FIN',
            nameFr: 'Services financiers',
            nameEn: 'Financials',
            marketValue: '765500',
            percent: '55.3',
          },
          {
            code: 'TEL',
            nameFr: 'Télécommunications',
            nameEn: 'Telecoms',
            marketValue: '619000',
            percent: '44.7',
          },
        ],
        unpriced: [{ ticker: 'NOPX', name: 'Sans Cours SA' }],
      },
    }

    it('shows each security’s share of the market value, then each sector’s', async () => {
      portfolioApi({ [VALUATION]: () => json(200, spread) })
      renderApp('/portfolio')

      const region = await screen.findByRole('region', { name: 'Répartition' })
      const bars = () =>
        within(region)
          .getAllByRole('listitem')
          .map((item) => text(item.textContent))
      expect(bars()).toEqual([
        'SNTSSONATEL44,7 %619 000 F CFA',
        'SGBCSGB CI27,9 %386 000 F CFA',
        'PALCPALM CI27,4 %379 500 F CFA',
      ])

      fireEvent.click(
        within(region).getByRole('button', { name: 'Par secteur' })
      )
      expect(bars()).toEqual([
        'Services financiers55,3 %765 500 F CFA',
        'Télécommunications44,7 %619 000 F CFA',
      ])
    })

    it('states which positions are left out for want of a closing price', async () => {
      portfolioApi({ [VALUATION]: () => json(200, spread) })
      renderApp('/portfolio')

      const region = await screen.findByRole('region', { name: 'Répartition' })
      expect(text(region.textContent)).toContain(
        'Hors répartition, faute de cours de clôture publié : NOPX.'
      )
    })
  })

  describe('display currency', () => {
    const signedInAs = (displayCurrency: 'XOF' | 'EUR') => () =>
      json(200, {
        accessToken: 'token',
        expiresIn: 900,
        user: { ...testUser, displayCurrency },
      })

    it('shows amounts in EUR at the peg rate when the user chose EUR', async () => {
      portfolioApi({ 'POST /api/auth/refresh': signedInAs('EUR') })
      renderApp('/portfolio')

      const table = within(
        (await screen.findByRole('heading', { name: 'Positions' })).closest(
          '[data-slot="card"]'
        ) as HTMLElement
      )
      const row = text(table.getByText('SNTS').closest('tr')!.textContent)
      expect(row).toContain('6,28 €') // PMP 4120.5 F
      expect(row).toContain('574,89 €') // market value 377 100 F
      expect(row).toContain('+9,54 €') // unrealised gain 6 255 F
      expect(row).not.toContain('F CFA')
      expect(
        screen.getByRole('button', { name: 'EUR', pressed: true })
      ).toBeTruthy()
    })

    it('switches to EUR and saves the choice to the account', async () => {
      let sent: unknown
      portfolioApi({
        'PATCH /api/users/me': async (request: Request) => {
          sent = await request.json()
          return json(200, { ...testUser, displayCurrency: 'EUR' })
        },
      })
      renderApp('/portfolio')

      const summary = await screen.findByRole('region', {
        name: 'Synthèse du portefeuille',
      })
      expect(text(summary.textContent)).toContain('377 100 F CFA')

      fireEvent.click(screen.getByRole('button', { name: 'EUR' }))

      await waitFor(() => expect(sent).toEqual({ displayCurrency: 'EUR' }))
      await waitFor(() =>
        expect(text(summary.textContent)).toContain('Valeur de marché574,89 €')
      )
      expect(
        screen.getByRole('button', { name: 'F CFA', pressed: false })
      ).toBeTruthy()
    })
  })

  it('lists ledger entries with their fees and SGI', async () => {
    portfolioApi()
    renderApp('/portfolio')

    const heading = await screen.findByRole('heading', { name: 'Écritures' })
    const card = within(heading.closest('[data-slot="card"]') as HTMLElement)
    const row = text(
      (await card.findByText('SGI Test Bourse')).closest('tr')!.textContent
    )
    expect(row).toContain('05/01/2026')
    expect(row).toContain('Achat')
    expect(row).toContain('2 000 F CFA')
  })

  it('records a sale with its fees and SGI', async () => {
    let sent: unknown
    portfolioApi({
      [`POST ${ENTRIES}`]: async (request: Request) => {
        sent = await request.json()
        return json(201, { ...entry, id: 'e2', kind: 'sell' })
      },
    })
    renderApp('/portfolio')
    await screen.findByRole('option', { name: 'SNTS · SONATEL' })

    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: 'sell' },
    })
    fireEvent.change(screen.getByLabelText('Valeur'), {
      target: { value: 'SNTS' },
    })
    fireEvent.change(screen.getByLabelText('Date de la transaction'), {
      target: { value: '2026-03-16' },
    })
    fireEvent.change(screen.getByLabelText('Quantité'), {
      target: { value: '60' },
    })
    fireEvent.change(screen.getByLabelText('Cours unitaire (F CFA)'), {
      target: { value: '4500' },
    })
    fireEvent.change(screen.getByLabelText('Frais totaux (F CFA)'), {
      target: { value: '1350' },
    })
    fireEvent.change(screen.getByLabelText('SGI'), {
      target: { value: 'SGI Test Bourse' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() =>
      expect(sent).toEqual({
        kind: 'sell',
        ticker: 'SNTS',
        date: '2026-03-16',
        quantity: '60',
        price: '4500',
        fees: '1350',
        sgi: 'SGI Test Bourse',
      })
    )
  })

  it('explains a refused sale of more shares than held', async () => {
    portfolioApi({
      [`POST ${ENTRIES}`]: () =>
        json(422, {
          message: 'Cannot sell',
          errors: [
            {
              code: 'LEDGER_ENTRY_001',
              context: { ticker: 'SNTS', held: '90', sold: '91' },
            },
          ],
        }),
    })
    renderApp('/portfolio')
    await screen.findByRole('option', { name: 'SNTS · SONATEL' })

    fireEvent.change(screen.getByLabelText('Type'), {
      target: { value: 'sell' },
    })
    fireEvent.change(screen.getByLabelText('Valeur'), {
      target: { value: 'SNTS' },
    })
    fireEvent.change(screen.getByLabelText('Date de la transaction'), {
      target: { value: '2026-05-01' },
    })
    fireEvent.change(screen.getByLabelText('Quantité'), {
      target: { value: '91' },
    })
    fireEvent.change(screen.getByLabelText('Cours unitaire (F CFA)'), {
      target: { value: '4500' },
    })
    fireEvent.change(screen.getByLabelText('SGI'), {
      target: { value: 'SGI Test Bourse' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Vente refusée : vous ne déteniez que 90 titres à cette date.'
    )
  })

  it('states the date performance is measured from, and that nothing is computed before it', async () => {
    portfolioApi({
      [VALUATION]: () =>
        json(200, { ...valuation, performanceSince: '2026-01-02' }),
    })
    renderApp('/portfolio')

    const summary = await screen.findByRole('region', {
      name: 'Synthèse du portefeuille',
    })
    expect(summary.textContent).toContain(
      'Performance mesurée depuis le 2 janvier 2026 : aucun rendement n’est calculé avant cette date.'
    )
  })

  it('lists an opening position with its PMP and no fees', async () => {
    portfolioApi({
      [`GET ${ENTRIES}`]: () =>
        json(200, [
          {
            ...entry,
            kind: 'opening_position',
            date: '2026-01-02',
            quantity: '200',
            price: '3850.25',
            fees: '0',
          },
        ]),
    })
    renderApp('/portfolio')

    const heading = await screen.findByRole('heading', { name: 'Écritures' })
    const card = within(heading.closest('[data-slot="card"]') as HTMLElement)
    const row = text(
      (await card.findByText('SGI Test Bourse')).closest('tr')!.textContent
    )
    expect(row).toContain('02/01/2026')
    expect(row).toContain('Position d’ouverture')
    expect(row).toContain('3 850,25 F CFAPMP')
    expect(row).toContain('—')
  })

  describe('correcting the ledger', () => {
    const entriesCard = async () =>
      within(
        (await screen.findByRole('heading', { name: 'Écritures' })).closest(
          '[data-slot="card"]'
        ) as HTMLElement
      )

    it('edits a trade: the form opens filled in, and the correction replaces it', async () => {
      let sent: unknown
      portfolioApi({
        [`PUT ${ENTRIES}/e1`]: async (request: Request) => {
          sent = await request.json()
          return json(200, { ...entry, id: 'e2', price: '3900' })
        },
      })
      renderApp('/portfolio')
      await screen.findByRole('option', { name: 'SNTS · SONATEL' })

      fireEvent.click(
        await (
          await entriesCard()
        ).findByRole('button', {
          name: 'Modifier l’écriture SNTS du 05/01/2026',
        })
      )
      await screen.findByRole('heading', { name: 'Corriger l’écriture' })
      expect(
        (screen.getByLabelText('Cours unitaire (F CFA)') as HTMLInputElement)
          .value
      ).toBe('4000')
      fireEvent.change(screen.getByLabelText('Cours unitaire (F CFA)'), {
        target: { value: '3900' },
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'Enregistrer la correction' })
      )

      await waitFor(() =>
        expect(sent).toEqual({
          kind: 'buy',
          ticker: 'SNTS',
          date: '2026-01-05',
          quantity: '100',
          price: '3900',
          fees: '2000',
          sgi: 'SGI Test Bourse',
        })
      )
      // Back to recording new entries.
      expect(
        await screen.findByRole('heading', {
          name: 'Enregistrer un achat ou une vente',
        })
      ).toBeTruthy()
    })

    it('explains a refused edit that would oversell at some date', async () => {
      portfolioApi({
        [`PUT ${ENTRIES}/e1`]: () =>
          json(422, {
            message: 'Cannot sell',
            errors: [
              {
                code: 'LEDGER_ENTRY_001',
                context: { ticker: 'SNTS', held: '40', sold: '60' },
              },
            ],
          }),
      })
      renderApp('/portfolio')
      await screen.findByRole('option', { name: 'SNTS · SONATEL' })

      fireEvent.click(
        await (
          await entriesCard()
        ).findByRole('button', {
          name: 'Modifier l’écriture SNTS du 05/01/2026',
        })
      )
      fireEvent.change(screen.getByLabelText('Quantité'), {
        target: { value: '40' },
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'Enregistrer la correction' })
      )

      expect((await screen.findByRole('alert')).textContent).toBe(
        'Vente refusée : vous ne déteniez que 40 titres à cette date.'
      )
    })

    it('can cancel an edit', async () => {
      portfolioApi()
      renderApp('/portfolio')

      fireEvent.click(
        await (
          await entriesCard()
        ).findByRole('button', {
          name: 'Modifier l’écriture SNTS du 05/01/2026',
        })
      )
      fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }))
      expect(
        await screen.findByRole('heading', {
          name: 'Enregistrer un achat ou une vente',
        })
      ).toBeTruthy()
    })

    it('edits an opening position with its own form', async () => {
      let sent: unknown
      const opening = {
        ...entry,
        kind: 'opening_position',
        date: '2026-01-02',
        quantity: '200',
        price: '3850.25',
        fees: '0',
      }
      portfolioApi({
        [`GET ${ENTRIES}`]: () => json(200, [opening]),
        [`PUT /api/portfolios/${PORTFOLIO_ID}/opening-positions/e1`]: async (
          request: Request
        ) => {
          sent = await request.json()
          return json(200, { ...opening, id: 'e2' })
        },
      })
      renderApp('/portfolio')
      await screen.findByRole('option', { name: 'SNTS · SONATEL' })

      fireEvent.click(
        await (
          await entriesCard()
        ).findByRole('button', {
          name: 'Modifier l’écriture SNTS du 02/01/2026',
        })
      )
      await screen.findByRole('heading', {
        name: 'Corriger la position d’ouverture',
      })
      fireEvent.change(screen.getByLabelText('Quantité détenue'), {
        target: { value: '180' },
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'Enregistrer la correction' })
      )

      await waitFor(() =>
        expect(sent).toEqual({
          ticker: 'SNTS',
          date: '2026-01-02',
          quantity: '180',
          pmp: '3850.25',
          sgi: 'SGI Test Bourse',
        })
      )
    })

    it('deletes an entry once confirmed', async () => {
      let deleted = false
      portfolioApi({
        [`DELETE ${ENTRIES}/e1`]: () => {
          deleted = true
          return new Response(null, { status: 204 })
        },
      })
      renderApp('/portfolio')

      fireEvent.click(
        await (
          await entriesCard()
        ).findByRole('button', {
          name: 'Supprimer l’écriture SNTS du 05/01/2026',
        })
      )
      const dialog = within(await screen.findByRole('dialog'))
      expect(dialog.getByText('Supprimer cette écriture ?')).toBeTruthy()
      expect(deleted).toBe(false)
      fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }))

      await waitFor(() => expect(deleted).toBe(true))
    })

    it('explains a refused deletion, and deletes nothing', async () => {
      portfolioApi({
        [`DELETE ${ENTRIES}/e1`]: () =>
          json(422, {
            message: 'Cannot sell',
            errors: [
              {
                code: 'LEDGER_ENTRY_001',
                context: { ticker: 'SNTS', held: '0', sold: '60' },
              },
            ],
          }),
      })
      renderApp('/portfolio')

      fireEvent.click(
        await (
          await entriesCard()
        ).findByRole('button', {
          name: 'Supprimer l’écriture SNTS du 05/01/2026',
        })
      )
      const dialog = within(await screen.findByRole('dialog'))
      fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }))

      expect((await dialog.findByRole('alert')).textContent).toBe(
        'Suppression refusée : une vente enregistrée ensuite dépasserait les 0 titres alors détenus.'
      )
    })
  })

  describe('onboarding an empty portfolio', () => {
    const emptyPortfolioApi = (routes = {}) =>
      portfolioApi({
        [VALUATION]: () =>
          json(200, {
            portfolio,
            positions: [],
            totals: {
              costBasis: '0',
              realisedGain: '0',
              marketValue: '0',
              unrealisedGain: '0',
            },
            performanceSince: null,
            allocation: {
              marketValue: '0',
              bySecurity: [],
              bySector: [],
              unpriced: [],
            },
          }),
        [`GET ${ENTRIES}`]: () => json(200, []),
        ...routes,
      })

    it('offers the opening position first and the full trade history second', async () => {
      emptyPortfolioApi()
      renderApp('/portfolio')

      const heading = await screen.findByRole('heading', {
        name: 'Comment voulez-vous commencer ?',
      })
      const card = within(heading.closest('[data-slot="card"]') as HTMLElement)
      expect(card.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'J’ai déjà des actions',
        'Saisir tout mon historique',
      ])
      // No form until the user has chosen how to start.
      expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull()
    })

    it('records an opening position: quantity and PMP as of a date', async () => {
      let sent: unknown
      emptyPortfolioApi({
        [`POST /api/portfolios/${PORTFOLIO_ID}/opening-positions`]: async (
          request: Request
        ) => {
          sent = await request.json()
          return json(201, { ...entry, kind: 'opening_position' })
        },
      })
      renderApp('/portfolio')

      fireEvent.click(
        await screen.findByRole('button', { name: 'J’ai déjà des actions' })
      )
      await screen.findByRole('heading', {
        name: 'Saisir une position d’ouverture',
      })
      await screen.findByRole('option', { name: 'SNTS · SONATEL' })
      fireEvent.change(screen.getByLabelText('Valeur'), {
        target: { value: 'SNTS' },
      })
      fireEvent.change(screen.getByLabelText('Détenu au'), {
        target: { value: '2026-01-02' },
      })
      fireEvent.change(screen.getByLabelText('Quantité détenue'), {
        target: { value: '200' },
      })
      fireEvent.change(screen.getByLabelText('PMP (F CFA, frais inclus)'), {
        target: { value: '3850.25' },
      })
      fireEvent.change(screen.getByLabelText('SGI'), {
        target: { value: 'SGI Test Bourse' },
      })
      fireEvent.click(
        screen.getByRole('button', { name: 'Enregistrer la position' })
      )

      await waitFor(() =>
        expect(sent).toEqual({
          ticker: 'SNTS',
          date: '2026-01-02',
          quantity: '200',
          pmp: '3850.25',
          sgi: 'SGI Test Bourse',
        })
      )
    })

    it('can start from the full trade history instead', async () => {
      emptyPortfolioApi()
      renderApp('/portfolio')

      fireEvent.click(
        await screen.findByRole('button', {
          name: 'Saisir tout mon historique',
        })
      )
      expect(
        await screen.findByRole('heading', {
          name: 'Enregistrer un achat ou une vente',
        })
      ).toBeTruthy()
    })
  })

  it('offers to create the first portfolio', async () => {
    let created: unknown
    fakeApi({
      'POST /api/auth/refresh': () => session('token'),
      'GET /api/portfolios': () => json(200, []),
      'POST /api/portfolios': async (request) => {
        created = await request.json()
        return json(201, portfolio)
      },
    })
    renderApp('/portfolio')

    await screen.findByRole('heading', { name: 'Créez votre portefeuille' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Créer le portefeuille' })
    )

    await waitFor(() => expect(created).toEqual({ name: 'Mon portefeuille' }))
  })
})
