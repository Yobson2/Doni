import { IconCloudOff } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useOnline } from '@/lib/offline/use-online'

/**
 * When the data on screen is a saved copy (offline, or the last refresh
 * failed), says when it was last synced with the server (ADR 0010).
 * `query` is a TanStack Query result: its `dataUpdatedAt` is that time.
 */
export function SyncedAt({
  query,
}: {
  query: { dataUpdatedAt: number; isRefetchError: boolean }
}) {
  const { t, i18n } = useTranslation()
  const online = useOnline()
  if ((online && !query.isRefetchError) || !query.dataUpdatedAt) return null
  const date = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(query.dataUpdatedAt)
  return (
    <p className='text-muted-foreground inline-flex items-center gap-1.5 text-sm'>
      <IconCloudOff aria-hidden='true' className='size-4' />
      <span>{t('offline.syncedAt', { date })}</span>
    </p>
  )
}
