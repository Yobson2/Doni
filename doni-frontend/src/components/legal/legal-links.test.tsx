// @vitest-environment jsdom
import i18n from '@/i18n'
import { fakeApi, json, session } from '@/test/fake-api'
import { renderApp } from '@/test/render-app'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

const links = {
  fr: { disclaimer: 'Avertissement', privacy: 'Politique de confidentialité' },
  en: { disclaimer: 'Disclaimer', privacy: 'Privacy policy' },
}

/** Both legal links, found inside `container`, point to their pages. */
function expectLegalLinks(container: HTMLElement, language: 'fr' | 'en') {
  const scope = within(container)
  expect(
    scope.getByRole('link', { name: links[language].disclaimer })
  ).toHaveProperty('pathname', '/disclaimer')
  expect(
    scope.getByRole('link', { name: links[language].privacy })
  ).toHaveProperty('pathname', '/privacy')
}

describe('legal pages are reachable', () => {
  beforeEach(async () => {
    useAuthStore.getState().auth.reset()
    await i18n.changeLanguage('fr')
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it.each(['fr', 'en'] as const)(
    'from the public footer, in %s',
    async (language) => {
      await i18n.changeLanguage(language)
      renderApp('/guides')
      expectLegalLinks(await screen.findByRole('contentinfo'), language)
    }
  )

  it('opens the disclaimer and the privacy policy from the footer', async () => {
    renderApp('/sgi')
    const footer = await screen.findByRole('contentinfo')

    fireEvent.click(within(footer).getByRole('link', { name: 'Avertissement' }))
    await screen.findByRole('heading', { level: 1, name: 'Avertissement' })
    expect(
      screen.getByText(/Rien sur Doni ne constitue un conseil/)
    ).toBeTruthy()

    fireEvent.click(
      within(screen.getByRole('contentinfo')).getByRole('link', {
        name: 'Politique de confidentialité',
      })
    )
    await screen.findByRole('heading', {
      level: 1,
      name: 'Politique de confidentialité',
    })
    // A draft until reviewed, and it says so.
    expect(screen.getByText(/BROUILLON - à faire relire/)).toBeTruthy()
  })

  it.each(['fr', 'en'] as const)(
    'from the sign-up form and the sign-up footer, in %s',
    async (language) => {
      await i18n.changeLanguage(language)
      renderApp('/sign-up')

      const consent = await screen.findByText(
        (_, el) =>
          el?.tagName === 'P' &&
          /^(En créant un compte|By creating an account)/.test(
            el.textContent ?? ''
          )
      )
      expect(
        within(consent).getByRole('link', {
          name: language === 'fr' ? 'avertissement' : 'disclaimer',
        })
      ).toHaveProperty('pathname', '/disclaimer')
      expect(
        within(consent).getByRole('link', {
          name:
            language === 'fr'
              ? 'politique de confidentialité'
              : 'privacy policy',
        })
      ).toHaveProperty('pathname', '/privacy')

      expectLegalLinks(screen.getByRole('contentinfo'), language)
    }
  )

  it('from the sign-in footer', async () => {
    renderApp('/sign-in')
    expectLegalLinks(await screen.findByRole('contentinfo'), 'fr')
  })

  it('from the signed-in app footer, and data pages link the disclaimer', async () => {
    fakeApi({
      'POST /api/auth/refresh': () => session('token'),
      'GET /api/watchlist': () => json(200, []),
    })
    renderApp('/watchlist')

    await screen.findByRole('heading', { level: 1, name: 'Ma liste de suivi' })
    expectLegalLinks(screen.getByRole('contentinfo'), 'fr')
    expect(
      within(screen.getByRole('main')).getByRole('link', {
        name: "Lire l'avertissement",
      })
    ).toHaveProperty('pathname', '/disclaimer')
  })
})
