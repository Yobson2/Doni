import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { IconMenu2, IconX } from '@tabler/icons-react'
import { Logo } from '@/components/logo'
import { APP_CONFIG } from '@/config/app'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export function LandingNavbar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <header className='bg-background/80 sticky top-0 z-50 border-b backdrop-blur-sm'>
      <div className='container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8'>
        <a href='/' className='flex items-center gap-2'>
          <Logo className='h-6 w-6' />
          <span className='text-lg font-semibold'>{APP_CONFIG.name}</span>
        </a>

        {/* Desktop nav */}
        <nav className='hidden items-center gap-6 md:flex'>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className='text-muted-foreground hover:text-foreground text-sm font-medium transition-colors'
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className='flex items-center gap-2'>
          {/* <ThemeSwitch /> */}
          <Button variant='ghost' size='sm' asChild className='hidden md:inline-flex'>
            <Link to='/sign-in'>Sign In</Link>
          </Button>
          <Button size='sm' asChild className='hidden md:inline-flex'>
            <Link to='/sign-up'>Get Started</Link>
          </Button>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant='ghost' size='icon' className='md:hidden'>
                {open ? <IconX className='h-5 w-5' /> : <IconMenu2 className='h-5 w-5' />}
                <span className='sr-only'>Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side='right' className='w-[300px]'>
              <SheetHeader>
                <SheetTitle className='flex items-center gap-2'>
                  <Logo className='h-5 w-5' />
                  {APP_CONFIG.name}
                </SheetTitle>
              </SheetHeader>
              <nav className='mt-8 flex flex-col gap-1'>
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className='text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2.5 text-base font-medium transition-colors'
                  >
                    {link.label}
                  </a>
                ))}
                <hr className='my-4' />
                <div className='flex flex-col gap-3 px-3'>
                  <Button variant='outline' size='lg' className='w-full' asChild>
                    <Link to='/sign-in' onClick={() => setOpen(false)}>Sign In</Link>
                  </Button>
                  <Button size='lg' className='w-full' asChild>
                    <Link to='/sign-up' onClick={() => setOpen(false)}>Get Started</Link>
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
