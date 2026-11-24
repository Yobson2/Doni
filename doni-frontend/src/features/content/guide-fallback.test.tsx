// @vitest-environment jsdom
import i18n from '@/i18n'
import { renderApp } from '@/test/render-app'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// A guide written in French only.
vi.mock('@/content/guides', async () => {
  const { ContentLibrary } = await import('@/content/library')
  return {
    guides: new ContentLibrary({
      './guides/fr/seule.md':
        '---\ntitle: Guide en français\nsummary: Résumé\nupdated: 2026-11-24\n---\n\nTexte.',
    }),
  }
})

describe('a guide not yet translated', () => {
  afterEach(cleanup)

  it('is shown in French with a visible note', async () => {
    await i18n.changeLanguage('en')
    renderApp('/guides/seule')

    await screen.findByRole('heading', { level: 1, name: 'Guide en français' })
    expect(screen.getByRole('note').textContent).toBe(
      'This page is not yet available in English. It is shown in French.'
    )
    expect(document.querySelector('article')?.lang).toBe('fr')
  })

  it('is marked as French in the English list', async () => {
    await i18n.changeLanguage('en')
    renderApp('/guides')

    await screen.findByRole('heading', { level: 2, name: 'Guide en français' })
    expect(screen.getByText('In French only for now')).toBeTruthy()
  })
})
