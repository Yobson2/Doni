import { Logo } from '@/components/logo'
import { APP_CONFIG } from '@/config/app'

export function LandingFooter() {
  return (
    <footer className='border-t'>
      <div className='container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8'>
        <div className='flex items-center gap-2'>
          <Logo className='h-5 w-5' />
          <span className='text-sm font-medium'>{APP_CONFIG.name}</span>
        </div>
        <p className='text-muted-foreground text-sm'>
          &copy; {new Date().getFullYear()} {APP_CONFIG.name}. All rights reserved.
        </p>
        <div className='flex gap-4'>
          <a
            href='#'
            className='text-muted-foreground hover:text-foreground text-sm transition-colors'
          >
            GitHub
          </a>
          <a
            href='#'
            className='text-muted-foreground hover:text-foreground text-sm transition-colors'
          >
            Documentation
          </a>
        </div>
      </div>
    </footer>
  )
}
