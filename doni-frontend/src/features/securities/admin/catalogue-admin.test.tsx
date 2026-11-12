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
    await screen.findByRole('option', { name: /SNTS/ })

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

  it('will not save a price without its source document', async () => {
    const { requests } = fakeApi({
      'POST /api/auth/refresh': adminSession,
      'GET /api/securities': () => json(200, [sonatel]),
      'GET /api/sectors': () => json(200, [sonatel.sector]),
    })

    renderApp('/admin/catalogue')
    await screen.findByRole('option', { name: /SNTS/ })
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
