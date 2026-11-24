import type { ReactNode } from 'react'
import type { ResolvedDocument } from '@/content/library'
import { useTranslation } from 'react-i18next'
import { MarkdownView } from '@/components/content/markdown-view'
import { DisclaimerLink } from '@/components/legal/disclaimer-link'
import { formatLongDate } from '@/features/securities/format'
import { useContentLanguage } from './use-content-language'

/** The column public content pages (guides, directory, legal) are laid out in. */
export function ContentColumn({ children }: { children: ReactNode }) {
  return (
    <div className='mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16'>
      {children}
    </div>
  )
}

/** A Markdown document as a page: title, date, notes, body. */
export function DocumentPage({
  resolved,
  before,
  withDisclaimer = true,
}: {
  resolved: ResolvedDocument
  before?: ReactNode
  withDisclaimer?: boolean
}) {
  const { t } = useTranslation()
  const language = useContentLanguage()
  const { document, isFallback } = resolved
  const { title, updated } = document.meta

  return (
    <ContentColumn>
      {before}
      <article lang={document.language}>
        <h1 className='font-manrope text-3xl font-bold tracking-tight sm:text-4xl'>
          {title}
        </h1>
        {updated && (
          <p className='text-muted-foreground mt-3 text-sm'>
            {t('content.updated', { date: formatLongDate(updated, language) })}
          </p>
        )}
        {isFallback && (
          <p
            role='note'
            lang={language}
            className='bg-info-subtle text-info mt-6 rounded-md px-4 py-3 text-sm'
          >
            {t('content.frenchOnly')}
          </p>
        )}
        <MarkdownView blocks={document.blocks} />
      </article>
      {withDisclaimer && <DisclaimerLink className='mt-12' />}
    </ContentColumn>
  )
}
