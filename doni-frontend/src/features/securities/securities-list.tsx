import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
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
import { securitiesQuery } from './api'
import { PageShell } from './components/page-shell'
import { formatShortDate, formatXof } from './format'

/** Every listed security with its latest end-of-day price and its date. */
export function SecuritiesList() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const securities = useQuery(securitiesQuery())

  return (
    <PageShell>
      <div className='mb-6 space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('securities.title')}
        </h1>
        <p className='text-muted-foreground'>{t('securities.description')}</p>
      </div>

      <Card>
        <CardContent>
          {securities.isPending ? (
            <Skeleton className='h-48 w-full' />
          ) : securities.isError ? (
            <p role='alert'>{t('securities.loadError')}</p>
          ) : securities.data.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('securities.empty')}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('securities.columns.ticker')}</TableHead>
                  <TableHead>{t('securities.columns.name')}</TableHead>
                  <TableHead className='hidden md:table-cell'>
                    {t('securities.columns.sector')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('securities.columns.close')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('securities.columns.asOf')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {securities.data.map((security) => (
                  <TableRow key={security.ticker}>
                    <TableCell className='font-mono font-medium'>
                      <Link
                        to='/securities/$ticker'
                        params={{ ticker: security.ticker }}
                        className='text-primary underline-offset-4 hover:underline'
                      >
                        {security.ticker}
                      </Link>
                    </TableCell>
                    <TableCell>{security.name}</TableCell>
                    <TableCell className='text-muted-foreground hidden md:table-cell'>
                      {lang === 'en'
                        ? security.sector.nameEn
                        : security.sector.nameFr}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {security.latestPrice
                        ? formatXof(security.latestPrice.close, lang)
                        : '—'}
                    </TableCell>
                    <TableCell className='text-muted-foreground text-right tabular-nums'>
                      {security.latestPrice
                        ? formatShortDate(security.latestPrice.date, lang)
                        : '—'}
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
