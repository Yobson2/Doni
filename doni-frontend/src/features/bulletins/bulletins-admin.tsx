import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageShell } from '@/features/securities/components/page-shell'
import {
  type Bulletin,
  bulletinQuery,
  correctBulletin,
  heldBulletinsQuery,
  publishBulletin,
} from './api'

const DECIMAL = /^\d{1,15}(\.\d{1,6})?$/

/**
 * Admin: trading days whose BOC failed an automatic check. Each held day can
 * be inspected (failed checks, values read), corrected, and published.
 * Users keep seeing the last published day until then.
 */
export function BulletinsAdmin() {
  const { t } = useTranslation()
  const held = useQuery(heldBulletinsQuery())
  const [selected, setSelected] = useState<string | null>(null)
  const date = selected ?? held.data?.[0]?.tradingDate ?? null

  return (
    <PageShell>
      <div className='mb-6 space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('admin.bulletins.title')}
        </h1>
        <p className='text-muted-foreground'>
          {t('admin.bulletins.description')}
        </p>
      </div>
      {held.data && held.data.length === 0 && (
        <p>{t('admin.bulletins.none')}</p>
      )}
      {held.data && held.data.length > 0 && (
        <div className='grid gap-6 lg:grid-cols-[16rem_1fr]'>
          <nav aria-label={t('admin.bulletins.heldDays')}>
            <h2 className='mb-2 font-semibold'>
              {t('admin.bulletins.heldDays')}
            </h2>
            <ul className='space-y-1'>
              {held.data.map((day) => (
                <li key={day.tradingDate}>
                  <button
                    type='button'
                    aria-current={day.tradingDate === date ? 'true' : undefined}
                    onClick={() => setSelected(day.tradingDate)}
                    className={cn(
                      'hover:bg-accent w-full rounded-md px-3 py-2 text-left text-sm',
                      day.tradingDate === date && 'bg-accent font-medium'
                    )}
                  >
                    {day.tradingDate}
                    <span className='text-muted-foreground block text-xs'>
                      {t('admin.bulletins.failureCount', {
                        count: day.failures.length,
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {date && <HeldDay key={date} date={date} />}
        </div>
      )}
    </PageShell>
  )
}

function HeldDay({ date }: { date: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const bulletin = useQuery(bulletinQuery(date))
  // Edited values, by ticker or index code; untouched rows are absent.
  const [edits, setEdits] = useState<Record<string, string>>({})

  const refresh = async (updated: Bulletin) => {
    queryClient.setQueryData(bulletinQuery(date).queryKey, updated)
    await queryClient.invalidateQueries({ queryKey: ['bulletins'] })
  }

  const correct = useMutation({
    mutationFn: () => {
      const data = bulletin.data as Bulletin
      return correctBulletin(date, {
        securities: data.securities
          .filter((s) => s.ticker in edits)
          .map((s) => ({ ticker: s.ticker, close: edits[s.ticker] })),
        indices: data.indices
          .filter((i) => i.code in edits)
          .map((i) => ({ code: i.code, value: edits[i.code] })),
      })
    },
    onSuccess: async (updated) => {
      setEdits({})
      toast.success(t('admin.bulletins.corrected'))
      await refresh(updated)
    },
    onError: () => toast.error(t('errors.toast.generic')),
  })

  const publish = useMutation({
    mutationFn: () => publishBulletin(date),
    onSuccess: async (updated) => {
      toast.success(t('admin.bulletins.published', { date }))
      await refresh(updated)
      await queryClient.invalidateQueries({ queryKey: ['securities'] })
    },
    onError: () => toast.error(t('errors.toast.generic')),
  })

  if (!bulletin.data) return null
  const data = bulletin.data
  const invalid = Object.values(edits).some((v) => !DECIMAL.test(v))
  const securities = data.securities.filter((s) => s.inCatalogue)
  const indices = data.indices.filter((i) => i.inCatalogue)

  const valueInput = (key: string, value: string) => (
    <Input
      aria-label={t('admin.bulletins.valueOf', { name: key })}
      inputMode='decimal'
      className='h-8 w-28'
      value={edits[key] ?? value}
      aria-invalid={key in edits && !DECIMAL.test(edits[key])}
      onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
    />
  )

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            {t('admin.bulletins.dayTitle', { date })}
            <Badge
              variant={data.status === 'published' ? 'default' : 'destructive'}
            >
              {t(`admin.bulletins.status.${data.status}`)}
            </Badge>
          </CardTitle>
          <CardDescription>
            <a
              href={data.sourceUrl}
              target='_blank'
              rel='noreferrer'
              className='underline'
            >
              {t('admin.bulletins.source', {
                reference: data.reference ?? '—',
              })}
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h3 className='mb-2 font-semibold'>
            {t('admin.bulletins.failures')}
          </h3>
          {data.failures.length === 0 ? (
            <p>{t('admin.bulletins.noFailures')}</p>
          ) : (
            <ul className='list-disc space-y-1 pl-5'>
              {data.failures.map((f, n) => (
                <li key={n}>
                  <span className='font-medium'>
                    {t(`admin.bulletins.checks.${f.check}`)}
                  </span>
                  {' — '}
                  {f.reason}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.bulletins.rows')}</CardTitle>
          <CardDescription>{t('admin.bulletins.rowsHelp')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.bulletins.columns.security')}</TableHead>
                <TableHead>{t('admin.bulletins.columns.previous')}</TableHead>
                <TableHead>{t('admin.bulletins.columns.close')}</TableHead>
                <TableHead>{t('admin.bulletins.columns.variation')}</TableHead>
                <TableHead>{t('admin.bulletins.columns.volume')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {securities.map((s) => (
                <TableRow key={s.ticker}>
                  <TableCell>
                    <span className='font-medium'>{s.ticker}</span>{' '}
                    <span className='text-muted-foreground'>{s.name}</span>
                    {!s.traded && (
                      <span className='text-muted-foreground ml-1 text-xs'>
                        ({t('admin.bulletins.notTraded')})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{s.previousClose ?? '—'}</TableCell>
                  <TableCell>{valueInput(s.ticker, s.close)}</TableCell>
                  <TableCell>
                    {s.variation === null ? '—' : `${s.variation} %`}
                  </TableCell>
                  <TableCell>{s.volume ?? '—'}</TableCell>
                </TableRow>
              ))}
              {indices.map((i) => (
                <TableRow key={i.code}>
                  <TableCell>
                    <span className='font-medium'>{i.code}</span>{' '}
                    <span className='text-muted-foreground'>{i.name}</span>
                  </TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>{valueInput(i.code, i.value)}</TableCell>
                  <TableCell>
                    {i.variation === null ? '—' : `${i.variation} %`}
                  </TableCell>
                  <TableCell>—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className='text-muted-foreground text-sm'>
            {t('admin.bulletins.notInCatalogue', {
              count: data.securities.length - securities.length,
            })}
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              disabled={
                Object.keys(edits).length === 0 || invalid || correct.isPending
              }
              onClick={() => correct.mutate()}
            >
              {t('admin.bulletins.saveCorrections')}
            </Button>
            <Button
              disabled={
                data.status === 'published' ||
                Object.keys(edits).length > 0 ||
                publish.isPending
              }
              onClick={() => publish.mutate()}
            >
              {t('admin.bulletins.publish')}
            </Button>
          </div>
          <p className='text-muted-foreground text-sm'>
            {t('admin.bulletins.publishHelp')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
