import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconStar, IconStarFilled } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { addToWatchlist, removeFromWatchlist, watchlistQuery } from './api'

/** Adds the security to the user's watchlist, or removes it. */
export function WatchButton({ ticker }: { ticker: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const watchlist = useQuery(watchlistQuery())
  const watched =
    watchlist.data?.some((item) => item.ticker === ticker) ?? false

  const mutation = useMutation({
    mutationFn: async () => {
      if (watched) await removeFromWatchlist(ticker)
      else await addToWatchlist(ticker)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: watchlistQuery().queryKey }),
    onError: () => toast.error(t('errors.toast.generic')),
  })

  const Icon = watched ? IconStarFilled : IconStar
  return (
    <Button
      variant='outline'
      size='sm'
      aria-pressed={watched}
      disabled={watchlist.isPending || mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <Icon aria-hidden='true' />
      {watched ? t('watchlist.watching') : t('watchlist.add')}
    </Button>
  )
}
