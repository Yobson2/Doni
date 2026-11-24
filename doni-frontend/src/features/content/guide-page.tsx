import { Link } from '@tanstack/react-router'
import { IconArrowLeft } from '@tabler/icons-react'
import { guides } from '@/content/guides'
import { useTranslation } from 'react-i18next'
import NotFoundError from '@/features/errors/not-found-error'
import { DocumentPage } from './content-page'
import { useContentLanguage } from './use-content-language'

export default function GuidePage({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const resolved = guides.get(slug, useContentLanguage())
  if (!resolved) return <NotFoundError />

  return (
    <DocumentPage
      resolved={resolved}
      before={
        <Link
          to='/guides'
          className='text-text-secondary hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm font-medium'
        >
          <IconArrowLeft className='size-4' aria-hidden='true' />
          {t('guides.all')}
        </Link>
      }
    />
  )
}
