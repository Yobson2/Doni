import { useMutation } from '@tanstack/react-query'
import { IconDownload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { downloadMyData } from './api'

/** Downloads all of the user's data as a JSON file. */
export function ExportData() {
  const { t } = useTranslation()
  const mutation = useMutation({
    mutationFn: downloadMyData,
    onError: () => toast.error(t('settings.account.export.error')),
  })

  return (
    <section className='space-y-3' aria-labelledby='export-data-title'>
      <h4 id='export-data-title' className='font-medium'>
        {t('settings.account.export.title')}
      </h4>
      <p className='text-muted-foreground text-sm'>
        {t('settings.account.export.description')}
      </p>
      <Button
        variant='outline'
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <IconDownload size={16} />
        {mutation.isPending
          ? t('settings.account.export.pending')
          : t('settings.account.export.submit')}
      </Button>
    </section>
  )
}
