import { legalPages } from '@/content/legal'
import { DocumentPage } from './content-page'
import { useContentLanguage } from './use-content-language'

/** The disclaimer or the privacy policy, in the active language. */
export default function LegalPage({
  slug,
}: {
  slug: 'disclaimer' | 'privacy'
}) {
  const resolved = legalPages.get(slug, useContentLanguage())
  // Both pages exist in French, the fallback language: a miss is a build error.
  if (!resolved) throw new Error(`Missing legal page: ${slug}`)
  return <DocumentPage resolved={resolved} withDisclaimer={false} />
}
