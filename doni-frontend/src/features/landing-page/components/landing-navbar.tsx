import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { IconMenu2 } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { LanguageSwitch } from '@/components/language-switch'
import { Wordmark } from '@/components/logo'
import { navLinks } from '../lib/nav-links'

export function LandingNavbar() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    mediaQuery.addEventListener('change', handleChange)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-200',
        scrolled
          ? 'bg-background/90 border-border backdrop-blur-md'
          : 'border-transparent bg-transparent'
      )}
    >
      <div className='mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8'>
        <Link
          to='/'
          aria-label={t('landing.nav.home')}
          className='flex items-center rounded-sm'
        >
          <Wordmark className='text-primary h-7 w-auto' aria-hidden='true' />
        </Link>

        <nav aria-label={t('landing.nav.main')} className='hidden md:block'>
          <ul className='flex items-center gap-1'>
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className='text-text-secondary hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm font-medium transition-colors'
                >
                  {t(`landing.nav.${link.label}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className='flex items-center gap-2'>
          <LanguageSwitch className='hidden md:inline-flex' />
          <Button variant='ghost' asChild className='hidden md:inline-flex'>
            <Link to='/sign-in'>{t('landing.nav.signIn')}</Link>
          </Button>
          <Button asChild className='hidden md:inline-flex'>
            <Link to='/sign-up'>{t('landing.nav.getStarted')}</Link>
          </Button>

          {/* Mobile: primary CTA stays visible, the rest lives in the sheet */}
          <Button asChild size='sm' className='h-10 md:hidden'>
            <Link to='/sign-up'>{t('landing.nav.getStarted')}</Link>
          </Button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant='ghost' size='icon' className='size-10 md:hidden'>
                <IconMenu2 className='size-5' aria-hidden='true' />
                <span className='sr-only'>{t('landing.nav.toggleMenu')}</span>
              </Button>
            </SheetTrigger>
            <SheetContent side='right' className='w-[min(320px,85vw)]'>
              <SheetHeader>
                <SheetTitle>
                  <Wordmark className='text-primary h-6 w-auto' />
                </SheetTitle>
              </SheetHeader>
              <nav
                aria-label={t('landing.nav.main')}
                className='flex flex-col gap-1 px-4'
              >
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className='hover:bg-accent flex min-h-12 items-center rounded-md px-3 text-base font-medium transition-colors'
                  >
                    {t(`landing.nav.${link.label}`)}
                  </a>
                ))}
              </nav>
              <div className='mt-auto flex flex-col gap-3 border-t p-4'>
                <LanguageSwitch className='self-start' />
                <Button
                  variant='outline'
                  size='lg'
                  className='h-12 w-full'
                  asChild
                >
                  <Link to='/sign-in' onClick={() => setOpen(false)}>
                    {t('landing.nav.signIn')}
                  </Link>
                </Button>
                <Button size='lg' className='h-12 w-full' asChild>
                  <Link to='/sign-up' onClick={() => setOpen(false)}>
                    {t('landing.nav.getStarted')}
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
