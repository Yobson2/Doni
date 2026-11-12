import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type LedgerEntry, deleteLedgerEntry } from '../api'
import { ledgerRefusal } from './form-fields'

/**
 * Asks for confirmation before deleting a ledger entry. The API refuses a
 * deletion that would leave a later sale uncovered; the dialog then says
 * why and stays open.
 */
export function DeleteEntryDialog({
  portfolioId,
  entry,
  label,
  onClose,
}: {
  portfolioId: string
  /** The entry to delete; the dialog is closed when null. */
  entry: LedgerEntry | null
  /** How the entry is named to the user, e.g. "SNTS du 05/01/2026". */
  label: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (id: string) => deleteLedgerEntry(portfolioId, id),
    onSuccess: async () => {
      toast.success(t('portfolio.delete.done'))
      await queryClient.invalidateQueries({
        queryKey: ['portfolios', portfolioId],
      })
      onClose()
    },
  })

  const refusal = mutation.isError
    ? ledgerRefusal(mutation.error, t, 'portfolio.delete.insufficient')
    : null

  return (
    <Dialog
      open={entry !== null}
      onOpenChange={(open) => {
        if (!open) {
          mutation.reset()
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('portfolio.delete.title')}</DialogTitle>
          <DialogDescription>
            {t('portfolio.delete.description', { entry: label })}
          </DialogDescription>
        </DialogHeader>
        {refusal && (
          <p role='alert' className='text-destructive text-sm'>
            {refusal}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline'>
              {t('portfolio.correction.cancel')}
            </Button>
          </DialogClose>
          <Button
            variant='destructive'
            disabled={mutation.isPending}
            onClick={() => entry && mutation.mutate(entry.id)}
          >
            {t('portfolio.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
