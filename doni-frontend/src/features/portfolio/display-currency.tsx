import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api, unwrap } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import type { DisplayCurrency } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { useDisplayCurrency } from './use-money'

const CURRENCIES: DisplayCurrency[] = ['XOF', 'EUR']

/**
 * Switches between XOF and EUR display. The choice is saved to the account
 * (ADR 0008), so it follows the user to every device and session; it shows
 * at once and goes back if it cannot be saved.
 */
export function CurrencyToggle() {
  const { t } = useTranslation()
  const currency = useDisplayCurrency()
  const save = useMutation({
    mutationFn: async (displayCurrency: DisplayCurrency) =>
      unwrap(await api.PATCH('/api/users/me', { body: { displayCurrency } })),
    onMutate: (displayCurrency) => {
      const { user, setUser } = useAuthStore.getState().auth
      if (user) setUser({ ...user, displayCurrency })
      return { previous: user }
    },
    onSuccess: (user) => useAuthStore.getState().auth.setUser(user),
    onError: (_error, _currency, context) => {
      if (context?.previous)
        useAuthStore.getState().auth.setUser(context.previous)
      toast.error(t('portfolio.currency.saveError'))
    },
  })

  return (
    <div className='space-y-1'>
      <div
        role='group'
        aria-label={t('portfolio.currency.label')}
        className='bg-muted inline-flex gap-1 rounded-md p-1'
      >
        {CURRENCIES.map((c) => (
          <Button
            key={c}
            size='sm'
            variant={c === currency ? 'secondary' : 'ghost'}
            aria-pressed={c === currency}
            disabled={save.isPending}
            onClick={() => c !== currency && save.mutate(c)}
          >
            {t(`portfolio.currency.${c}`)}
          </Button>
        ))}
      </div>
      {currency === 'EUR' && (
        <p className='text-muted-foreground text-xs'>
          {t('portfolio.currency.peg')}
        </p>
      )}
    </div>
  )
}
