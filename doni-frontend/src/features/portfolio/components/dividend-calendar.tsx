import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OnlineButton } from '@/components/offline/online-button'
import { formatQuantity, formatShortDate } from '@/features/securities/format'
import {
  type DividendItem,
  confirmDividend,
  dividendsQuery,
  setDividendDismissed,
} from '../api'
import { useMoney } from '../use-money'

/** A net amount greater than zero, as the API accepts it. */
const NET_AMOUNT = /^(?!0+(\.0+)?$)\d{1,15}(\.\d{1,6})?$/

/** Not paid yet: the ex-date or the payment date is still to come. */
const isUpcoming = (item: DividendItem) =>
  item.status === 'upcoming' || item.status === 'awaiting_payment'

/**
 * The portfolio's dividend calendar: declared dividends on the securities it
 * holds, upcoming first, then past ones, most recent first. A paid dividend
 * is suggested from the shares held at its ex-date; it counts only once the
 * user confirms the net amount received, which records it in the ledger.
 */
export function DividendCalendar({ portfolioId }: { portfolioId: string }) {
  const { t } = useTranslation()
  const dividends = useQuery(dividendsQuery(portfolioId))
  const [confirming, setConfirming] = useState<DividendItem | null>(null)

  const upcoming = dividends.data?.filter(isUpcoming) ?? []
  const past = (dividends.data?.filter((i) => !isUpcoming(i)) ?? []).reverse()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('portfolio.dividends.title')}</h2>
        </CardTitle>
        <CardDescription>
          {t('portfolio.dividends.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {dividends.isPending ? (
          <Skeleton className='h-24 w-full' />
        ) : dividends.isLoadingError ? (
          <p role='alert'>{t('portfolio.loadError')}</p>
        ) : dividends.data.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>
            {t('portfolio.dividends.empty')}
          </p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <DividendTable
                title={t('portfolio.dividends.upcoming')}
                items={upcoming}
                portfolioId={portfolioId}
                onConfirm={setConfirming}
              />
            )}
            {past.length > 0 && (
              <DividendTable
                title={t('portfolio.dividends.past')}
                items={past}
                portfolioId={portfolioId}
                onConfirm={setConfirming}
              />
            )}
          </>
        )}
        <ConfirmDividendDialog
          portfolioId={portfolioId}
          item={confirming}
          onClose={() => setConfirming(null)}
        />
      </CardContent>
    </Card>
  )
}

function DividendTable({
  title,
  items,
  portfolioId,
  onConfirm,
}: {
  title: string
  items: DividendItem[]
  portfolioId: string
  onConfirm: (item: DividendItem) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const money = useMoney()
  const queryClient = useQueryClient()
  const dismissal = useMutation({
    mutationFn: ({ item, dismiss }: { item: DividendItem; dismiss: boolean }) =>
      setDividendDismissed(portfolioId, item.referenceDividendId, dismiss),
    onSuccess: async (_, { dismiss }) => {
      toast.success(
        t(
          dismiss
            ? 'portfolio.dividends.dismissed'
            : 'portfolio.dividends.restored'
        )
      )
      await queryClient.invalidateQueries({
        queryKey: ['portfolios', portfolioId, 'dividends'],
      })
    },
    onError: () => toast.error(t('errors.toast.generic')),
  })
  const nameOf = (item: DividendItem) =>
    t('portfolio.entries.name', {
      ticker: item.ticker,
      date: formatShortDate(item.paymentDate, lang),
    })

  return (
    <section aria-label={title} className='space-y-2'>
      <h3 className='text-sm font-medium'>{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('portfolio.dividends.security')}</TableHead>
            <TableHead>{t('portfolio.dividends.exDate')}</TableHead>
            <TableHead>{t('portfolio.dividends.paymentDate')}</TableHead>
            <TableHead className='text-right'>
              {t('portfolio.dividends.shares')}
            </TableHead>
            <TableHead className='text-right'>
              {t('portfolio.dividends.grossPerShare')}
            </TableHead>
            <TableHead className='text-right'>
              {t('portfolio.dividends.amount')}
            </TableHead>
            <TableHead>{t('portfolio.dividends.status.label')}</TableHead>
            <TableHead className='text-right'>
              <span className='sr-only'>{t('portfolio.entries.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const confirmed = item.status === 'confirmed'
            const dismissed = item.status === 'dismissed'
            const actionable =
              item.status === 'suggested' || item.status === 'awaiting_payment'
            return (
              <TableRow
                key={item.referenceDividendId}
                className={cn(dismissed && 'text-muted-foreground')}
              >
                <TableCell>
                  <span className='font-mono font-medium'>{item.ticker}</span>
                  <a
                    href={item.sourceNoticeUrl}
                    target='_blank'
                    rel='noreferrer'
                    className='text-muted-foreground block text-xs underline'
                  >
                    {t('portfolio.dividends.notice')}
                  </a>
                </TableCell>
                <TableCell className='tabular-nums'>
                  {formatShortDate(item.exDate, lang)}
                </TableCell>
                <TableCell className='tabular-nums'>
                  {formatShortDate(item.paymentDate, lang)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {formatQuantity(item.shares, lang)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {money.pmp(item.grossPerShare)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {confirmed && item.netAmount ? (
                    <>
                      {money.amount(item.netAmount)}
                      <span className='text-muted-foreground block text-xs'>
                        {t('portfolio.dividends.net')}
                      </span>
                    </>
                  ) : (
                    <>
                      {money.amount(item.grossAmount)}
                      <span className='text-muted-foreground block text-xs'>
                        {t(
                          item.status === 'upcoming'
                            ? 'portfolio.dividends.estimate'
                            : 'portfolio.dividends.gross'
                        )}
                      </span>
                    </>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={confirmed ? 'secondary' : 'outline'}>
                    {t(`portfolio.dividends.status.${item.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className='text-right whitespace-nowrap'>
                  {item.status === 'suggested' && (
                    <OnlineButton
                      size='sm'
                      aria-label={t('portfolio.dividends.confirmLabel', {
                        dividend: nameOf(item),
                      })}
                      onClick={() => onConfirm(item)}
                    >
                      {t('portfolio.dividends.confirm')}
                    </OnlineButton>
                  )}
                  {actionable && (
                    <OnlineButton
                      size='sm'
                      variant='ghost'
                      disabled={dismissal.isPending}
                      aria-label={t('portfolio.dividends.dismissLabel', {
                        dividend: nameOf(item),
                      })}
                      onClick={() => dismissal.mutate({ item, dismiss: true })}
                    >
                      {t('portfolio.dividends.dismiss')}
                    </OnlineButton>
                  )}
                  {dismissed && (
                    <OnlineButton
                      size='sm'
                      variant='ghost'
                      disabled={dismissal.isPending}
                      aria-label={t('portfolio.dividends.restoreLabel', {
                        dividend: nameOf(item),
                      })}
                      onClick={() => dismissal.mutate({ item, dismiss: false })}
                    >
                      {t('portfolio.dividends.restore')}
                    </OnlineButton>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}

/**
 * Asks for the net amount actually received (withholding varies), then
 * records it in the ledger as a user dividend.
 */
function ConfirmDividendDialog({
  portfolioId,
  item,
  onClose,
}: {
  portfolioId: string
  /** The dividend to confirm; the dialog is closed when null. */
  item: DividendItem | null
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [invalid, setInvalid] = useState(false)
  const mutation = useMutation({
    mutationFn: (value: string) =>
      confirmDividend(portfolioId, item!.referenceDividendId, value),
    onSuccess: async () => {
      toast.success(t('portfolio.dividends.form.saved'))
      await queryClient.invalidateQueries({
        queryKey: ['portfolios', portfolioId],
      })
      close()
    },
  })

  function close() {
    setAmount('')
    setInvalid(false)
    mutation.reset()
    onClose()
  }

  const refusal = mutation.isError
    ? mutation.error instanceof ApiError && mutation.error.status === 409
      ? t('portfolio.dividends.form.already')
      : t('errors.toast.generic')
    : null

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault()
            const value = amount.trim()
            if (!NET_AMOUNT.test(value)) {
              setInvalid(true)
              return
            }
            mutation.mutate(value)
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t('portfolio.dividends.form.title', {
                ticker: item?.ticker ?? '',
              })}
            </DialogTitle>
            <DialogDescription>
              {item &&
                t('portfolio.dividends.form.description', {
                  shares: formatQuantity(item.shares, i18n.language),
                  gross: money.amount(item.grossAmount),
                })}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='dividend-net-amount'>
              {t('portfolio.dividends.form.amount')}
            </Label>
            <Input
              id='dividend-net-amount'
              inputMode='decimal'
              autoComplete='off'
              value={amount}
              aria-invalid={invalid}
              onChange={(event) => {
                setAmount(event.target.value)
                setInvalid(false)
              }}
            />
            {invalid && (
              <p role='alert' className='text-destructive text-sm'>
                {t('portfolio.dividends.form.invalid')}
              </p>
            )}
          </div>
          {refusal && (
            <p role='alert' className='text-destructive text-sm'>
              {refusal}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type='button' variant='outline'>
                {t('portfolio.correction.cancel')}
              </Button>
            </DialogClose>
            <OnlineButton type='submit' disabled={mutation.isPending}>
              {t('portfolio.dividends.form.submit')}
            </OnlineButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
