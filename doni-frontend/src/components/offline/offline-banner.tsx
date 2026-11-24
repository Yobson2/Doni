import { IconWifiOff } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useOnline } from '@/lib/offline/use-online'

/** Id of the banner text; offline write buttons point to it for their reason. */
export const OFFLINE_NOTICE_ID = 'offline-notice'

/**
 * Shown on every page while there is no connection: the data is the last
 * synced copy and nothing can be changed until the connection is back.
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  const online = useOnline()
  if (online) return null
  return (
    <div
      role='status'
      className='bg-warning-subtle text-foreground sticky top-0 z-[70] flex items-center justify-center gap-2 border-b px-4 py-2 text-center text-sm'
    >
      <IconWifiOff aria-hidden='true' className='size-4 shrink-0' />
      <p id={OFFLINE_NOTICE_ID}>
        <strong className='font-semibold'>{t('offline.banner.title')}</strong>{' '}
        {t('offline.banner.description')}
      </p>
    </div>
  )
}
