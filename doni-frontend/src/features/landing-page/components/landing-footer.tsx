import { useTranslation } from 'react-i18next'
import { Wordmark } from '@/components/logo'
import { APP_CONFIG } from '@/config/app'

export function LandingFooter() {
  const { t } = useTranslation()
  return (
    <footer className='border-t'>
      <div className='container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6 lg:px-8'>
        <Wordmark className='text-primary h-6 w-auto' />
        <p className='text-muted-foreground text-sm'>
          {t('landing.footer.copyright', {
            year: new Date().getFullYear(),
            name: APP_CONFIG.name,
          })}
        </p>
        <p className='text-muted-foreground text-sm'>{t('app.disclaimer')}</p>
      </div>
    </footer>
  )
}
