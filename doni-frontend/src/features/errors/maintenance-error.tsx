import { useTranslation } from 'react-i18next'
import { AnimatedContainer } from '@/components/motion/animated-container'

export default function MaintenanceError() {
  const { t } = useTranslation()
  return (
    <div className='h-svh'>
      <AnimatedContainer variant='fadeSlideUp' className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>503</h1>
        <span className='font-medium'>{t('errors.maintenance.title')}</span>
        <p className='text-muted-foreground max-w-sm text-center'>
          {t('errors.maintenance.description')}
        </p>
      </AnimatedContainer>
    </div>
  )
}
