// @vitest-environment jsdom
import i18n from '@/i18n'
import { fakeApi, json, session, testUser } from '@/test/fake-api'
import { renderApp } from '@/test/render-app'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

const BOC = 'https://www.brvm.org/sites/default/files/boc_20261111_2.pdf'

const adminSession = () =>
  json(200, {
    accessToken: 'admin-token',
    expiresIn: 900,
    user: { ...testUser, role: 'ADMIN' },
  })

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

describe('catalogue admin', () => {
  beforeEach(async () => {
    useAuthStore.getState().auth.reset()
    await i18n.changeLanguage('fr')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('is not open to members', async () => {
    fakeApi({ 'POST /api/auth/refresh': () => session('member-token') })

    const router = renderApp('/admin/catalogue')

    await waitFor(() => expect(router.state.location.pathname).toBe('/403'))
  })

  it('enters an end-of-day price with its BOC and publication date', async () => {
    let saved: { path: string; body: unknown } | undefined
    fakeApi({
      'POST /api/auth/refresh': adminSession,
      'GET /api/securities': () => json(200, [sonatel]),
      'GET /api/sectors': () => json(200, [sonatel.sector]),
      'PUT /api/securities/SNTS/prices/2026-11-11': async (request) => {
        saved = {
          path: new URL(request.url).pathname,
          body: await request.json(),
        }
        return json(200, {})
      },
    })

    renderApp('/admin/catalogue')
    await screen.findAllByRole('option', { name: /SNTS/ })

    const fill = (label: RegExp, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fill(/^Valeur$/, 'SNTS')
    fill(/^Séance$/, '2026-11-11')
    fill(/^Cours de clôture/, '4190')
    fill(/^Volume/, '85624')
    fill(/^Document source/, BOC)
    fill(/^Date de publication/, '2026-11-11')
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer le cours' })
    )

    await waitFor(() => expect(saved).toBeDefined())
    expect(saved).toEqual({
      path: '/api/securities/SNTS/prices/2026-11-11',
      body: {
        close: '4190',
        volume: '85624',
        sourceDocument: BOC,
        publishedOn: '2026-11-11',
      },
    })
  })

  describe('corporate actions', () => {
    // Test data only: not a real BRVM notice.
    const NOTICE = 'https://www.brvm.org/fr/avis/test-split'
    const existing = {
      id: '0b6c1d8e-7f2a-4c11-9d3e-5a8b7c6d5e4f',
      ticker: 'SNTS',
      kind: 'free_shares',
      effectiveDate: '2026-06-15',
      ratioHeld: 10,
      ratioReceived: 1,
      cashInLieuPrice: null,
      subscriptionPrice: null,
      sourceNoticeUrl: NOTICE,
    }

    function openWithActions(routes = {}) {
      return fakeApi({
        'POST /api/auth/refresh': adminSession,
        'GET /api/securities': () => json(200, [sonatel]),
        'GET /api/sectors': () => json(200, [sonatel.sector]),
        'GET /api/securities/SNTS/corporate-actions': () =>
          json(200, [existing]),
        ...routes,
      })
    }

    it('enters a split with its ratio, effective date and source notice', async () => {
      let saved: unknown
      openWithActions({
        'POST /api/securities/SNTS/corporate-actions': async (
          request: Request
        ) => {
          saved = await request.json()
          return json(201, { ...existing, id: 'new', kind: 'split' })
        },
      })

      renderApp('/admin/catalogue')
      await screen.findAllByRole('option', { name: /SNTS/ })
      const fill = (label: RegExp, value: string) =>
        fireEvent.change(screen.getByLabelText(label), { target: { value } })
      fill(/^Valeur concernée$/, 'SNTS')
      fill(/^Type d’opération$/, 'split')
      fill(/^Date d’effet$/, '2026-04-02')
      fill(/^Actions détenues/, '1')
      fill(/^Actions reçues/, '5')
      fill(/^Avis BRVM/, NOTICE)
      fireEvent.click(
        screen.getByRole('button', { name: 'Enregistrer l’opération' })
      )

      await waitFor(() => expect(saved).toBeDefined())
      expect(saved).toEqual({
        kind: 'split',
        effectiveDate: '2026-04-02',
        ratioHeld: 1,
        ratioReceived: 5,
        sourceNoticeUrl: NOTICE,
      })
    })

    it('will not save a corporate action without its source notice', async () => {
      const { requests } = openWithActions()

      renderApp('/admin/catalogue')
      await screen.findAllByRole('option', { name: /SNTS/ })
      const fill = (label: RegExp, value: string) =>
        fireEvent.change(screen.getByLabelText(label), { target: { value } })
      fill(/^Valeur concernée$/, 'SNTS')
      fill(/^Type d’opération$/, 'split')
      fill(/^Date d’effet$/, '2026-04-02')
      fill(/^Actions détenues/, '1')
      fill(/^Actions reçues/, '5')
      fireEvent.click(
        screen.getByRole('button', { name: 'Enregistrer l’opération' })
      )

      expect(
        await screen.findByText('Saisissez le lien de l’avis BRVM.')
      ).toBeTruthy()
      expect(
        requests.some((r) => r.method === 'POST' && r.url.includes('corporate'))
      ).toBe(false)
    })

    it('lists the security’s corporate actions with their notice and removes one', async () => {
      let deleted = false
      openWithActions({
        'DELETE /api/securities/SNTS/corporate-actions/0b6c1d8e-7f2a-4c11-9d3e-5a8b7c6d5e4f':
          () => {
            deleted = true
            return new Response(null, { status: 204 })
          },
      })

      renderApp('/admin/catalogue')
      await screen.findAllByRole('option', { name: /SNTS/ })
      fireEvent.change(screen.getByLabelText(/^Valeur concernée$/), {
        target: { value: 'SNTS' },
      })

      const notice = await screen.findByRole('link', { name: /Avis BRVM/ })
      expect(notice.getAttribute('href')).toBe(NOTICE)
      fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }))

      await waitFor(() => expect(deleted).toBe(true))
    })
  })

  it('will not save a price without its source document', async () => {
    const { requests } = fakeApi({
      'POST /api/auth/refresh': adminSession,
      'GET /api/securities': () => json(200, [sonatel]),
      'GET /api/sectors': () => json(200, [sonatel.sector]),
    })

    renderApp('/admin/catalogue')
    await screen.findAllByRole('option', { name: /SNTS/ })
    fireEvent.change(screen.getByLabelText(/^Valeur$/), {
      target: { value: 'SNTS' },
    })
    fireEvent.change(screen.getByLabelText(/^Séance$/), {
      target: { value: '2026-11-11' },
    })
    fireEvent.change(screen.getByLabelText(/^Cours de clôture/), {
      target: { value: '4190' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer le cours' })
    )

    expect(await screen.findAllByText('Champ obligatoire.')).not.toHaveLength(0)
    expect(requests.some((r) => r.method === 'PUT')).toBe(false)
  })
})
