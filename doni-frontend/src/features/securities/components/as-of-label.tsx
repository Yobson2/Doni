import { IconCalendar } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { formatLongDate } from '../format'

/**
 * States that a price is the official closing price of a given trading day.
 * Prices are end-of-day only: never call them live (ADR 0003).
 */
export function AsOfLabel({ date }: { date: string }) {
  const { t, i18n } = useTranslation()
  return (
    <p className='text-muted-foreground inline-flex items-center gap-1.5 text-sm'>
      <IconCalendar aria-hidden='true' className='size-4' />
      <span>
        {t('securities.asOf', { date: formatLongDate(date, i18n.language) })}
      </span>
    </p>
  )
}
