import { ContentLibrary } from './library'

/** The legal pages, from `legal/<lang>/<slug>.md`, bundled at build time. */
export const legalPages = new ContentLibrary(
  import.meta.glob<string>('./legal/*/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
)
