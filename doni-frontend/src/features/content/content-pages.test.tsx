// @vitest-environment jsdom
import { alphabetical, sgis } from '@/content/sgi/sgis'
import i18n from '@/i18n'
import { renderApp } from '@/test/render-app'
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatLongDate } from '@/features/securities/format'

/** No network at all: content must come from the bundle (offline once loaded). */
function goOffline() {
  const fetch = vi.fn(() => Promise.reject(new TypeError('offline')))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('guides', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it.each([
    ['fr', 'Guides', "Qu'est-ce que la BRVM ?", 'Lire un avis de dividende'],
    ['en', 'Guides', 'What is the BRVM?', 'Reading a dividend notice'],
  ])(
    'lists the guides in %s',
    async (language, heading, firstGuide, thirdGuide) => {
      await i18n.changeLanguage(language)
      renderApp('/guides')

      await screen.findByRole('heading', { level: 1, name: heading })
      const titles = within(screen.getByRole('main'))
        .getAllByRole('heading', { level: 2 })
        .map((h) => h.textContent)
      expect(titles[0]).toBe(firstGuide)
      expect(titles).toContain(thirdGuide)
    }
  )

  it.each([
    [
      'fr',
      "Qu'est-ce que la BRVM ?",
      'Une bourse pour huit pays',
      /Mis à jour le 24 novembre 2026/,
    ],
    [
      'en',
      'What is the BRVM?',
      'One exchange for eight countries',
      /Updated November 24, 2026/,
    ],
  ])(
    'shows a guide in %s without any network request',
    async (language, title, section, updated) => {
      await i18n.changeLanguage(language)
      const fetch = goOffline()
      renderApp('/guides/brvm')

      await screen.findByRole('heading', { level: 1, name: title })
      expect(
        screen.getByRole('heading', { level: 2, name: section })
      ).toBeTruthy()
      expect(screen.getByText(updated)).toBeTruthy()
      expect(screen.queryByRole('note')).toBeNull() // not a fallback
      expect(document.querySelector('article')?.lang).toBe(language)
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('answers not found for an unknown guide', async () => {
    await i18n.changeLanguage('fr')
    renderApp('/guides/inconnu')
    await screen.findByText('404')
  })
})

describe('SGI directory', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it.each(['fr', 'en'])(
    'shows every fee with its source and its date, in %s',
    async (language) => {
      await i18n.changeLanguage(language)
      goOffline()
      renderApp('/sgi')

      const listed = alphabetical(sgis, language)
      await screen.findByRole('heading', { level: 1 })
      const names = within(screen.getByRole('main')).getAllByRole('heading', {
        level: 2,
      })
      expect(names.map((h) => h.textContent)).toEqual(listed.map((s) => s.name))

      const tables = screen.getAllByRole('table')
      listed.forEach((sgi, i) => {
        const rows = within(tables[i]).getAllByTestId('sgi-fee')
        expect(rows).toHaveLength(sgi.fees.length)
        sgi.fees.forEach((fee, j) => {
          const text = rows[j].textContent ?? ''
          expect(text).toContain(fee.value)
          expect(text).toContain(fee.source)
          expect(text).toContain(formatLongDate(fee.asOf, language))
        })
      })
    }
  )

  it('says that sample entries are not real data', async () => {
    await i18n.changeLanguage('fr')
    renderApp('/sgi')
    expect((await screen.findByRole('note')).textContent).toMatch(
      /pas des données réelles/
    )
  })
})
