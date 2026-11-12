// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from './en.json'
import fr from './fr.json'

const STORAGE_KEY = 'doni-lang'

// Importing the module again after resetModules() simulates a page reload.
async function loadI18n() {
  vi.resetModules()
  return import('@/i18n')
}

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )
}

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = ''
  })

  it('defaults to French when no language was chosen', async () => {
    const { default: i18n } = await loadI18n()
    expect(i18n.language).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('ignores an unsupported stored language', async () => {
    localStorage.setItem(STORAGE_KEY, 'de')
    const { default: i18n } = await loadI18n()
    expect(i18n.language).toBe('fr')
  })

  it('persists the chosen language across a reload', async () => {
    const first = await loadI18n()
    await first.default.changeLanguage('en')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en')
    expect(document.documentElement.lang).toBe('en')

    document.documentElement.lang = ''
    const reloaded = await loadI18n()
    expect(reloaded.default.language).toBe('en')
    expect(reloaded.default.t('nav.dashboard')).toBe('Dashboard')
    expect(document.documentElement.lang).toBe('en')
  })

  it('has the same keys in French and English', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort())
  })
})
