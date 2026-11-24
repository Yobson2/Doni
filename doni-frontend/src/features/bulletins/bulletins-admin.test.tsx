// @vitest-environment jsdom
import i18n from '@/i18n'
import { fakeApi, json, session, testUser } from '@/test/fake-api'
import { renderApp } from '@/test/render-app'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

const adminSession = () =>
  json(200, {
    accessToken: 'admin-token',
    expiresIn: 900,
    user: { ...testUser, role: 'ADMIN' },
  })

const failure = {
  check: 'securities_present',
  subject: 'BOAB',
  reason: 'BOAB is in the catalogue but not listed in the bulletin.',
}

const summary = {
  tradingDate: '2026-11-10',
  status: 'pending_review',
  reference: '214',
  sourceUrl: 'https://www.brvm.org/sites/default/files/boc_20261110_2.pdf',
  checksum: 'a'.repeat(64),
  fetchedAt: '2026-11-10T18:30:00.000Z',
  failures: [failure],
  reviewedAt: null,
}

const held = {
  ...summary,
  securities: [
    {
      ticker: 'SNTS',
      name: 'SONATEL SN',
      inCatalogue: true,
      previousClose: '4130',
      open: '4100',
      close: '4000',
      volume: '120000',
      variation: '-3.15',
      traded: true,
    },
    {
      ticker: 'NTLC',
      name: 'NESTLE CI',
      inCatalogue: false,
      previousClose: '13000',
      open: '13000',
      close: '13000',
      volume: '10',
      variation: '0.00',
      traded: true,
    },
  ],
  indices: [
    {
      code: 'BRVM-C',
      name: 'BRVM COMPOSITE',
      inCatalogue: true,
      value: '512.81',
      variation: '-1.74',
    },
  ],
}

describe('bulletins review (admin)', () => {
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
    const router = renderApp('/admin/bulletins')
    await waitFor(() => expect(router.state.location.pathname).toBe('/403'))
  })

  it('says so when no day is held', async () => {
    fakeApi({
      'POST /api/auth/refresh': adminSession,
      'GET /api/bulletins': () => json(200, []),
    })
    renderApp('/admin/bulletins')
    expect(await screen.findByText(/Aucune séance en attente/)).toBeTruthy()
  })

  it('shows a held day with its failed checks and the values read', async () => {
    const { requests } = fakeApi({
      'POST /api/auth/refresh': adminSession,
      'GET /api/bulletins': () => json(200, [summary]),
      'GET /api/bulletins/2026-11-10': () => json(200, held),
    })
    renderApp('/admin/bulletins')

    expect(await screen.findByText('Séance du 2026-11-10')).toBeTruthy()
    expect(screen.getByText(/BOAB is in the catalogue/)).toBeTruthy()
    expect(screen.getByText('Valeurs présentes')).toBeTruthy()
    expect(
      (screen.getByLabelText('Valeur de SNTS') as HTMLInputElement).value
    ).toBe('4000')
    expect(
      (screen.getByLabelText('Valeur de BRVM-C') as HTMLInputElement).value
    ).toBe('512.81')
    // Only catalogued rows are listed; the others are counted.
    expect(screen.queryByText('NTLC')).toBeNull()
    expect(
      screen.getByText(/1 valeur du bulletin n’est pas au catalogue/)
    ).toBeTruthy()
    const list = requests.find((r) => r.url.includes('/api/bulletins?'))
    expect(new URL(list!.url).searchParams.get('status')).toBe('pending_review')
  })

  it('corrects a misread value, then publishes the day', async () => {
    let correction: unknown
    let publishedDay = false
    fakeApi({
      'POST /api/auth/refresh': adminSession,
      'GET /api/bulletins': () => json(200, [summary]),
      'GET /api/bulletins/2026-11-10': () => json(200, held),
      'PATCH /api/bulletins/2026-11-10': async (request) => {
        correction = await request.json()
        return json(200, held)
      },
      'POST /api/bulletins/2026-11-10/publish': () => {
        publishedDay = true
        return json(200, { ...held, status: 'published' })
      },
    })
    renderApp('/admin/bulletins')

    const snts = await screen.findByLabelText('Valeur de SNTS')
    fireEvent.change(snts, { target: { value: '4005' } })
    // Unsaved corrections must be saved before publishing.
    expect(
      screen
        .getByRole('button', { name: 'Publier la séance' })
        .hasAttribute('disabled')
    ).toBe(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Enregistrer les corrections' })
    )
    await waitFor(() =>
      expect(correction).toEqual({
        securities: [{ ticker: 'SNTS', close: '4005' }],
        indices: [],
      })
    )

    const publish = screen.getByRole('button', { name: 'Publier la séance' })
    await waitFor(() => expect(publish.hasAttribute('disabled')).toBe(false))
    fireEvent.click(publish)
    await waitFor(() => expect(publishedDay).toBe(true))
  })
})
