import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { IconTrash } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageShell } from '@/features/securities/components/page-shell'
import { formatShortDate, formatXof } from '@/features/securities/format'
import { removeFromWatchlist, watchlistQuery } from './api'

/**
 * The securities the user follows, each with its latest end-of-day price
 * and the trading day it applies to.
 */
export function WatchlistPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const queryClient = useQueryClient()
  const watchlist = useQuery(watchlistQuery())

  const remove = useMutation({
    mutationFn: removeFromWatchlist,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: watchlistQuery().queryKey }),
    onError: () => toast.error(t('errors.toast.generic')),
  })

  return (
    <PageShell>
      <div className='mb-6 space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('watchlist.title')}
        </h1>
        <p className='text-muted-foreground'>{t('watchlist.description')}</p>
      </div>

      <Card>
        <CardContent>
          {watchlist.isPending ? (
            <Skeleton className='h-48 w-full' />
          ) : watchlist.isError ? (
            <p role='alert'>{t('securities.loadError')}</p>
          ) : watchlist.data.length === 0 ? (
            <div className='space-y-2 py-8 text-center text-sm'>
              <p className='text-muted-foreground'>{t('watchlist.empty')}</p>
              <Link
                to='/securities'
                className='text-primary underline-offset-4 hover:underline'
              >
                {t('watchlist.browse')}
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('securities.columns.ticker')}</TableHead>
                  <TableHead>{t('securities.columns.name')}</TableHead>
                  <TableHead className='text-right'>
                    {t('securities.columns.close')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('securities.columns.asOf')}
                  </TableHead>
                  <TableHead>
                    <span className='sr-only'>{t('watchlist.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlist.data.map((item) => (
                  <TableRow key={item.ticker}>
                    <TableCell className='font-mono font-medium'>
                      <Link
                        to='/securities/$ticker'
                        params={{ ticker: item.ticker }}
                        className='text-primary underline-offset-4 hover:underline'
                      >
                        {item.ticker}
                      </Link>
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {item.latestPrice
                        ? formatXof(item.latestPrice.close, lang)
                        : '—'}
                    </TableCell>
                    <TableCell className='text-muted-foreground text-right tabular-nums'>
                      {item.latestPrice
                        ? formatShortDate(item.latestPrice.date, lang)
                        : '—'}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label={t('watchlist.remove', {
                          ticker: item.ticker,
                        })}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(item.ticker)}
                      >
                        <IconTrash aria-hidden='true' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
