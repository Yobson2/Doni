// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'doni-lang'

afterEach(cleanup)

describe('LanguageSwitch', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('switches every string to English and keeps the choice after a reload', async () => {
    const { default: i18n } = await import('@/i18n')
    const { LanguageSwitch } = await import('./language-switch')
    const { useTranslation } = await import('react-i18next')

    function Probe() {
      const { t } = useTranslation()
      return <h1>{t('nav.dashboard')}</h1>
    }

    render(
      <>
        <LanguageSwitch />
        <Probe />
      </>
    )

    const fr = screen.getByRole('button', { name: 'fr' })
    const en = screen.getByRole('button', { name: 'en' })
    expect(screen.getByRole('heading').textContent).toBe('Tableau de bord')
    expect(fr.getAttribute('aria-pressed')).toBe('true')

    await act(async () => {
      fireEvent.click(en)
    })

    expect(i18n.language).toBe('en')
    expect(screen.getByRole('heading').textContent).toBe('Dashboard')
    expect(en.getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en')

    // Reload: a fresh i18n instance reads the persisted choice.
    vi.resetModules()
    const { default: reloaded } = await import('@/i18n')
    expect(reloaded.language).toBe('en')
  })
})
