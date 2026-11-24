import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { useOnline } from '@/lib/offline/use-online'
import { Button } from '@/components/ui/button'
import { OFFLINE_NOTICE_ID } from './offline-banner'

/**
 * A button that writes to the server: disabled while offline (ADR 0010: no
 * offline writes, no queue), with the reason as its tooltip and its
 * accessible description (the offline banner). Use it for every write action.
 */
export function OnlineButton({
  disabled,
  title,
  ...props
}: ComponentProps<typeof Button>) {
  const { t } = useTranslation()
  const online = useOnline()
  return (
    <Button
      {...props}
      disabled={disabled || !online}
      title={online ? title : t('offline.writeDisabled')}
      aria-describedby={online ? props['aria-describedby'] : OFFLINE_NOTICE_ID}
    />
  )
}
