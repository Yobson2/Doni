import { Link } from '@tanstack/react-router'
import { IconChevronRight } from '@tabler/icons-react'
import { guides } from '@/content/guides'
import { useTranslation } from 'react-i18next'
import { DisclaimerLink } from '@/components/legal/disclaimer-link'
import { ContentColumn } from './content-page'
import { useContentLanguage } from './use-content-language'

export default function GuidesList() {
  const { t } = useTranslation()
  const language = useContentLanguage()
  const list = guides.list(language)

  return (
    <ContentColumn>
      <h1 className='font-manrope text-3xl font-bold tracking-tight sm:text-4xl'>
        {t('guides.title')}
      </h1>
      <p className='text-text-secondary mt-3'>{t('guides.description')}</p>
      <ul className='mt-10 flex flex-col gap-4'>
        {list.map(({ document, isFallback }) => (
          <li key={document.slug}>
            <Link
              to='/guides/$slug'
              params={{ slug: document.slug }}
              className='bg-card hover:border-primary/40 flex items-center gap-4 rounded-lg border p-5 transition-colors'
            >
              <div className='flex-1'>
                <h2 lang={document.language} className='font-semibold'>
                  {document.meta.title}
                </h2>
                <p
                  lang={document.language}
                  className='text-text-secondary mt-1 text-sm'
                >
                  {document.meta.summary}
                </p>
                {isFallback && (
                  <p className='text-muted-foreground mt-2 text-xs'>
                    {t('guides.inFrench')}
                  </p>
                )}
              </div>
              <IconChevronRight
                aria-hidden='true'
                className='text-muted-foreground size-5 shrink-0'
              />
            </Link>
          </li>
        ))}
      </ul>
      <p className='text-text-secondary mt-10 text-sm'>
        {t('guides.sgiPrompt')}{' '}
        <Link
          to='/sgi'
          className='text-primary font-medium underline-offset-4 hover:underline'
        >
          {t('sgi.title')}
        </Link>
      </p>
      <DisclaimerLink className='mt-12' />
    </ContentColumn>
  )
}
