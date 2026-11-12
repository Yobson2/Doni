import { Link } from '@tanstack/react-router'
import { IconArrowLeft, IconCheck } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitch } from '@/components/language-switch'
import { Logo, Wordmark } from '@/components/logo'
import { AnimatedContainer } from '@/components/motion/animated-container'

const points = ['pmp', 'dividends', 'dated'] as const

/** Sign-in / sign-up shell: brand panel (desktop) + form column. */
export function AuthSplitLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const { t } = useTranslation()

  return (
    <div className='grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]'>
      <aside className='bg-primary text-primary-foreground relative hidden overflow-hidden p-10 lg:flex lg:flex-col xl:p-14'>
        <Link
          to='/'
          aria-label={t('landing.nav.home')}
          className='self-start rounded-sm'
        >
          <Wordmark className='h-8 w-auto' aria-hidden='true' />
        </Link>
        <div className='relative z-10 mt-auto max-w-md'>
          <p className='font-manrope text-3xl leading-tight font-bold tracking-tight xl:text-4xl'>
            {t('auth.panelTitle')}
          </p>
          <ul className='mt-8 flex flex-col gap-4'>
            {points.map((p) => (
              <li key={p} className='flex items-start gap-3'>
                <span className='bg-primary-foreground/15 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md'>
                  <IconCheck className='size-4' aria-hidden='true' />
                </span>
                <span className='text-primary-foreground/90'>
                  {t(`auth.points.${p}`)}
                </span>
              </li>
            ))}
          </ul>
          <p className='text-primary-foreground/70 mt-10 text-xs'>
            {t('auth.disclaimer')}
          </p>
        </div>
        <Logo
          accent='currentColor'
          className='text-primary-foreground/10 pointer-events-none absolute -top-10 -right-16 size-96'
        />
      </aside>

      <div className='flex flex-col px-5 py-6 sm:px-8'>
        <div className='flex items-center justify-between gap-4'>
          <Link
            to='/'
            className='text-text-secondary hover:text-foreground inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium'
          >
            <IconArrowLeft className='size-4' aria-hidden='true' />
            <span className='lg:hidden'>
              <Wordmark
                className='text-primary h-6 w-auto'
                aria-hidden='true'
              />
              <span className='sr-only'>{t('auth.backHome')}</span>
            </span>
            <span className='hidden lg:inline'>{t('auth.backHome')}</span>
          </Link>
          <LanguageSwitch />
        </div>

        <main
          id='content'
          className='flex flex-1 items-center justify-center py-10'
        >
          <AnimatedContainer variant='fadeSlideUp' className='w-full max-w-sm'>
            <h1 className='font-manrope text-3xl font-bold tracking-tight'>
              {title}
            </h1>
            <p className='text-text-secondary mt-2 text-sm'>{subtitle}</p>
            <div className='mt-8'>{children}</div>
            {footer && (
              <div className='text-text-secondary mt-8 text-sm'>{footer}</div>
            )}
            <p className='text-muted-foreground mt-10 text-xs lg:hidden'>
              {t('auth.disclaimer')}
            </p>
          </AnimatedContainer>
        </main>
      </div>
    </div>
  )
}
