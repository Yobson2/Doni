// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'doni-language'

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

    expect(screen.getByRole('heading').textContent).toBe('Tableau de bord')
    const button = screen.getByRole('button', { name: 'Passer en anglais' })

    await act(async () => {
      fireEvent.click(button)
    })

    expect(i18n.language).toBe('en')
    expect(screen.getByRole('heading').textContent).toBe('Dashboard')
    expect(
      screen.getByRole('button', { name: 'Switch to French' })
    ).toBeTruthy()
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en')

    // Reload: a fresh i18n instance reads the persisted choice.
    vi.resetModules()
    const { default: reloaded } = await import('@/i18n')
    expect(reloaded.language).toBe('en')
  })
})
