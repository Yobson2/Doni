import { ContentLibrary } from './library'

/** The guides, from `guides/<lang>/<slug>.md`, bundled at build time. */
export const guides = new ContentLibrary(
  import.meta.glob<string>('./guides/*/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
)
