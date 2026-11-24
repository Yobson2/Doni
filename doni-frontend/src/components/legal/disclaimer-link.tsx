import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/**
 * The short information-only notice with a link to the full disclaimer,
 * carried by every data page (ADR 0002).
 */
export function DisclaimerLink({
  notice,
  className,
}: {
  /** The page's own notice (e.g. where its figures come from); defaults to the generic one. */
  notice?: string
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <p className={cn('text-muted-foreground text-xs', className)}>
      {notice ?? t('legal.notice')}{' '}
      <Link
        to='/disclaimer'
        className='hover:text-foreground underline underline-offset-4'
      >
        {t('legal.readDisclaimer')}
      </Link>
    </p>
  )
}
