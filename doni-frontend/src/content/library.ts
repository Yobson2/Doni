import { type MarkdownDocument, parseMarkdown } from './markdown'

/** Languages content is written in; French is the default (ADR 0012). */
type ContentLanguage = 'fr' | 'en'
const DEFAULT_LANGUAGE: ContentLanguage = 'fr'

interface ContentDocument extends MarkdownDocument {
  slug: string
  /** The language this document is written in. */
  language: ContentLanguage
}

export interface ResolvedDocument {
  document: ContentDocument
  /** True when the requested language was missing and French is shown. */
  isFallback: boolean
}

/**
 * Content shipped with the app: Markdown files under `<folder>/<lang>/<slug>.md`,
 * imported at build time so they are part of the static bundle and need no
 * request at run time (the service worker of #18 precaches them with it).
 */
export class ContentLibrary {
  private readonly byLanguage = new Map<string, Map<string, ContentDocument>>()

  /** `files` maps a path ending in `/<lang>/<slug>.md` to the file's text. */
  constructor(files: Record<string, string>) {
    for (const [path, source] of Object.entries(files)) {
      const match = /\/(fr|en)\/([\w-]+)\.md$/.exec(path)
      if (!match) continue
      const [, language, slug] = match as unknown as [
        string,
        ContentLanguage,
        string,
      ]
      const docs = this.byLanguage.get(language) ?? new Map()
      docs.set(slug, { ...parseMarkdown(source), slug, language })
      this.byLanguage.set(language, docs)
    }
  }

  /** The document in `language`, or in French if it has not been translated. */
  get(slug: string, language: string): ResolvedDocument | undefined {
    const wanted = this.byLanguage.get(language)?.get(slug)
    if (wanted) return { document: wanted, isFallback: false }
    const fallback = this.byLanguage.get(DEFAULT_LANGUAGE)?.get(slug)
    return fallback && { document: fallback, isFallback: true }
  }

  /** Every document, each in `language` where available, by `order` then title. */
  list(language: string): ResolvedDocument[] {
    const slugs = new Set(
      [...this.byLanguage.values()].flatMap((docs) => [...docs.keys()])
    )
    return [...slugs]
      .map((slug) => this.get(slug, language))
      .filter((d): d is ResolvedDocument => d !== undefined)
      .sort(
        (a, b) =>
          Number(a.document.meta.order ?? Infinity) -
            Number(b.document.meta.order ?? Infinity) ||
          (a.document.meta.title ?? '').localeCompare(
            b.document.meta.title ?? '',
            language
          )
      )
  }
}
