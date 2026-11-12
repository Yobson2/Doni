import { Link } from '@tanstack/react-router'
import { APP_CONFIG } from '@/config/app'
import { useTranslation } from 'react-i18next'
import { LanguageSwitch } from '@/components/language-switch'
import { Wordmark } from '@/components/logo'
import { navLinks } from '../lib/nav-links'

const linkClass =
  'text-text-secondary hover:text-foreground text-sm transition-colors'

export function LandingFooter() {
  const { t } = useTranslation()

  return (
    <footer className='bg-card border-t'>
      <div className='mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-12'>
        <div className='md:col-span-6'>
          <Wordmark className='text-primary h-7 w-auto' />
          <p className='text-text-secondary mt-4 max-w-sm text-sm'>
            {t('landing.footer.tagline')}
          </p>
          <p className='text-muted-foreground mt-6 max-w-sm text-xs leading-relaxed'>
            {t('landing.footer.disclaimer')}
          </p>
        </div>
        <nav aria-label={t('landing.footer.product')} className='md:col-span-3'>
          <h2 className='text-sm font-semibold'>
            {t('landing.footer.product')}
          </h2>
          <ul className='mt-4 flex flex-col gap-3'>
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={linkClass}>
                  {t(`landing.nav.${link.label}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={t('landing.footer.account')} className='md:col-span-3'>
          <h2 className='text-sm font-semibold'>
            {t('landing.footer.account')}
          </h2>
          <ul className='mt-4 flex flex-col gap-3'>
            <li>
              <Link to='/sign-up' className={linkClass}>
                {t('landing.nav.getStarted')}
              </Link>
            </li>
            <li>
              <Link to='/sign-in' className={linkClass}>
                {t('landing.nav.signIn')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className='border-t'>
        <div className='mx-auto flex max-w-7xl flex-col-reverse items-start justify-between gap-4 px-5 py-6 sm:flex-row sm:items-center sm:px-8'>
          <p className='text-muted-foreground text-xs'>
            &copy; {new Date().getFullYear()} {APP_CONFIG.name}.{' '}
            {t('landing.footer.rights')}
          </p>
          <LanguageSwitch />
        </div>
      </div>
    </footer>
  )
}
