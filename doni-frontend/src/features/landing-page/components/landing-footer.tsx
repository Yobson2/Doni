import { Wordmark } from '@/components/logo'
import { APP_CONFIG } from '@/config/app'

export function LandingFooter() {
  return (
    <footer className='border-t'>
      <div className='container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8'>
        <Wordmark className='text-primary h-6 w-auto' />
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
