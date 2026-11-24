import { useTranslation } from 'react-i18next'

export default function MaintenanceError() {
  const { t } = useTranslation()
  return (
    <div className='h-svh'>
      <div className='animate-in fade-in slide-in-from-bottom-4 m-auto flex h-full w-full flex-col items-center justify-center gap-2 duration-300 motion-reduce:animate-none'>
        <h1 className='text-[7rem] leading-tight font-bold'>503</h1>
        <span className='font-medium'>{t('errors.maintenance.title')}</span>
        <p className='text-muted-foreground max-w-sm text-center'>
          {t('errors.maintenance.description')}
        </p>
      </div>
    </div>
  )
}
