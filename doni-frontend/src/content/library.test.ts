import { describe, expect, it } from 'vitest'
import { guides } from './guides'
import { legalPages } from './legal'
import { ContentLibrary } from './library'

const doc = (title: string, order?: number) =>
  `---\ntitle: ${title}\n${order ? `order: ${order}\n` : ''}---\nBody`

describe('ContentLibrary', () => {
  const library = new ContentLibrary({
    './guides/fr/b.md': doc('Bêta', 2),
    './guides/fr/a.md': doc('Alpha', 1),
    './guides/en/a.md': doc('Alpha EN', 1),
  })

  it('serves a document in the requested language', () => {
    const resolved = library.get('a', 'en')
    expect(resolved?.document.meta.title).toBe('Alpha EN')
    expect(resolved?.isFallback).toBe(false)
  })

  it('falls back to French when a translation is missing', () => {
    const resolved = library.get('b', 'en')
    expect(resolved?.document.meta.title).toBe('Bêta')
    expect(resolved?.document.language).toBe('fr')
    expect(resolved?.isFallback).toBe(true)
  })

  it('lists every document once, by order', () => {
    expect(library.list('en').map((d) => d.document.meta.title)).toEqual([
      'Alpha EN',
      'Bêta',
    ])
  })

  it('has nothing for an unknown slug', () => {
    expect(library.get('missing', 'fr')).toBeUndefined()
  })
})

describe('shipped content', () => {
  it.each(['fr', 'en'])(
    'has every guide in %s with a title, a summary and a date',
    (language) => {
      const list = guides.list(language)
      expect(list.length).toBeGreaterThanOrEqual(2)
      for (const { document, isFallback } of list) {
        expect(isFallback).toBe(false)
        expect(document.meta.title).toBeTruthy()
        expect(document.meta.summary).toBeTruthy()
        expect(document.meta.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  )

  it.each(['fr', 'en'])(
    'has the disclaimer and privacy policy in %s, marked as drafts',
    (language) => {
      for (const slug of ['disclaimer', 'privacy']) {
        const resolved = legalPages.get(slug, language)
        expect(resolved?.isFallback).toBe(false)
        // Until reviewed: remove `draft: true` once the text is approved.
        expect(resolved?.document.meta.draft).toBe('true')
      }
    }
  )
})
