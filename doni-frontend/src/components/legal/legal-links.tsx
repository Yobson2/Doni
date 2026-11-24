import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const linkClass =
  'text-text-secondary hover:text-foreground text-sm transition-colors'

/** The links every layout's footer carries: disclaimer and privacy policy. */
export function LegalLinks({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-2', className)}>
      <li>
        <Link to='/disclaimer' className={linkClass}>
          {t('legal.disclaimer')}
        </Link>
      </li>
      <li>
        <Link to='/privacy' className={linkClass}>
          {t('legal.privacy')}
        </Link>
      </li>
    </ul>
  )
}

/** The footer of layouts without a full footer (sign-in/up, signed-in app). */
export function LegalFooter({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <footer className={cn('px-4 py-4', className)}>
      <nav aria-label={t('legal.footerLabel')}>
        <LegalLinks className='[&_a]:text-xs' />
      </nav>
    </footer>
  )
}
