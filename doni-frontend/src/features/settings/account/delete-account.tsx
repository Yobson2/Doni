import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'
import { deleteMyAccount } from './api'

/**
 * Deletes the account. The user must re-enter their password and tick an
 * explicit confirmation before the button is enabled.
 */
export function DeleteAccount() {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [understood, setUnderstood] = useState(false)
  const passwordId = useId()
  const confirmId = useId()

  const mutation = useMutation({
    mutationFn: () => deleteMyAccount(password),
    onSuccess: async () => {
      queryClient.clear()
      toast.success(t('settings.account.delete.success'))
      await router.navigate({ to: '/' })
    },
  })

  const wrongPassword =
    mutation.error instanceof ApiError && mutation.error.status === 403

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setPassword('')
      setUnderstood(false)
      mutation.reset()
    }
  }

  return (
    <section className='space-y-3' aria-labelledby='delete-account-title'>
      <h4 id='delete-account-title' className='text-destructive font-medium'>
        {t('settings.account.delete.title')}
      </h4>
      <p className='text-muted-foreground text-sm'>
        {t('settings.account.delete.description')}
      </p>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant='destructive'>
            {t('settings.account.delete.open')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form
            className='grid gap-4'
            onSubmit={(event) => {
              event.preventDefault()
              mutation.mutate()
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {t('settings.account.delete.confirmTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('settings.account.delete.confirmDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className='grid gap-2'>
              <Label htmlFor={passwordId}>
                {t('settings.account.delete.password')}
              </Label>
              <PasswordInput
                id={passwordId}
                autoComplete='current-password'
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={wrongPassword || undefined}
              />
              {wrongPassword && (
                <p role='alert' className='text-destructive text-sm'>
                  {t('settings.account.delete.wrongPassword')}
                </p>
              )}
              {mutation.isError && !wrongPassword && (
                <p role='alert' className='text-destructive text-sm'>
                  {t('errors.toast.generic')}
                </p>
              )}
            </div>
            <div className='flex items-start gap-2'>
              <input
                id={confirmId}
                type='checkbox'
                className='accent-destructive mt-1 size-4'
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
              />
              <Label htmlFor={confirmId} className='leading-snug font-normal'>
                {t('settings.account.delete.understand')}
              </Label>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type='button' variant='outline'>
                  {t('settings.account.delete.cancel')}
                </Button>
              </DialogClose>
              <Button
                type='submit'
                variant='destructive'
                disabled={!password || !understood || mutation.isPending}
              >
                {t('settings.account.delete.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
