// @vitest-environment jsdom
import i18n from '@/i18n'
import { fakeApi, json, session } from '@/test/fake-api'
import { renderApp } from '@/test/render-app'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

const PASSWORD = 'CorrectHorse9!'

const exported = {
  format: 'doni-account-export',
  version: 1,
  exportedAt: '2026-11-12T10:00:00.000Z',
  sections: { account: {}, portfolios: [], sessions: [], watchlist: [] },
}

function fakeAccountApi() {
  return fakeApi({
    'POST /api/auth/refresh': () => session('token'),
    'GET /api/account/export': () => json(200, exported),
    'POST /api/account/deletion': async (request) => {
      const body = (await request.json()) as { password: string }
      return body.password === PASSWORD
        ? new Response(null, { status: 204 })
        : json(403, { code: 'AUTH_REAUTH_001' })
    },
  })
}

// Whole-app renders are slow on a loaded machine.
vi.setConfig({ testTimeout: 20000 })

describe('account and data settings', () => {
  beforeEach(async () => {
    useAuthStore.getState().auth.reset()
    await i18n.changeLanguage('fr')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('downloads my data as a JSON file', async () => {
    const api = fakeAccountApi()
    // jsdom has no object URLs.
    URL.createObjectURL = vi.fn(() => 'blob:export')
    URL.revokeObjectURL = vi.fn()
    const clicked: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push(this.download)
    })
    renderApp('/settings/account')

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Télécharger mes données (JSON)',
      })
    )

    await waitFor(() =>
      expect(clicked).toEqual(['doni-export-2026-11-12.json'])
    )
    expect(
      api.requests.some(
        (r) => r.method === 'GET' && r.url.endsWith('/api/account/export')
      )
    ).toBe(true)
  })

  it('asks for the password and an explicit confirmation before deleting', async () => {
    const api = fakeAccountApi()
    const router = renderApp('/settings/account')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Supprimer mon compte…' })
    )
    const submit = await screen.findByRole('button', {
      name: 'Supprimer définitivement mon compte',
    })
    expect(submit.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'wrong-password' },
    })
    expect(submit.hasAttribute('disabled')).toBe(true)
    fireEvent.click(
      screen.getByLabelText(
        'Je comprends que mon compte et toutes mes données seront supprimés définitivement.'
      )
    )
    expect(submit.hasAttribute('disabled')).toBe(false)

    fireEvent.click(submit)
    expect(await screen.findByText('Mot de passe incorrect.')).toBeTruthy()
    expect(useAuthStore.getState().auth.accessToken).toBe('token')

    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: PASSWORD },
    })
    fireEvent.click(submit)

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(useAuthStore.getState().auth.accessToken).toBe('')
    const deletions = api.requests.filter((r) =>
      r.url.endsWith('/api/account/deletion')
    )
    expect(deletions).toHaveLength(2)
  })

  it('is in the settings menu, in French and in English', async () => {
    fakeAccountApi()
    // The settings menu is shown on every settings page.
    renderApp('/settings/account')

    // The page title has the same text; keep only the menu link.
    const link = (text: string) =>
      screen
        .getAllByText(text)
        .map((el) => el.closest('a')?.getAttribute('href'))
        .filter(Boolean)
    await waitFor(() =>
      expect(link('Compte et données')).toEqual(['/settings/account'])
    )
    await i18n.changeLanguage('en')
    await waitFor(() =>
      expect(link('Account & data')).toEqual(['/settings/account'])
    )
  })
})
