import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LandingFooter } from '@/features/landing-page/components/landing-footer'
import { LandingNavbar } from '@/features/landing-page/components/landing-navbar'

export const Route = createFileRoute('/_public')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  return (
    <div className='flex min-h-svh flex-col'>
      <a
        href='#content'
        className='bg-primary text-primary-foreground fixed top-3 left-3 z-[60] -translate-y-24 rounded-md px-4 py-2 text-sm font-medium transition-transform focus:translate-y-0'
      >
        {t('landing.nav.skip')}
      </a>
      <LandingNavbar />
      <main id='content' tabIndex={-1} className='flex-1 outline-none'>
        <Outlet />
      </main>
      <LandingFooter />
    </div>
  )
}
