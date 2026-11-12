import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

/** A ledger form's submit button, with a cancel button when correcting. */
export function SubmitButtons({
  pending,
  label,
  onCancel,
}: {
  pending: boolean
  label: string
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-wrap gap-2'>
      <Button disabled={pending} className='flex-1'>
        {label}
      </Button>
      {onCancel && (
        <Button type='button' variant='outline' onClick={onCancel}>
          {t('portfolio.correction.cancel')}
        </Button>
      )}
    </div>
  )
}
