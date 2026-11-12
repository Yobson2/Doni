import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { IconArrowLeft, IconLanguage } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { WatchButton } from '@/features/watchlist/watch-button'
import {
  type EndOfDayPrice,
  type Security,
  securityPricesQuery,
  securityQuery,
} from './api'
import { AsOfLabel } from './components/as-of-label'
import { PageShell } from './components/page-shell'
import { PriceHistoryChart } from './components/price-history-chart'
import { formatQuantity, formatShortDate, formatXof } from './format'

/** A security's profile, latest end-of-day price and price history. */
export function CompanyPage({ ticker }: { ticker: string }) {
  const { t } = useTranslation()
  const security = useQuery(securityQuery(ticker))
  const prices = useQuery(securityPricesQuery(ticker))

  return (
    <PageShell>
      <Link
        to='/securities'
        className='text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm'
      >
        <IconArrowLeft aria-hidden='true' className='size-4' />
        {t('securities.backToList')}
      </Link>

      {security.isPending ? (
        <Skeleton className='h-24 w-full' />
      ) : security.isError ? (
        <p role='alert'>{t('securities.loadError')}</p>
      ) : (
        <div className='space-y-6'>
          <CompanyHeader security={security.data} />
          <Card>
            <CardHeader>
              <CardTitle>{t('securities.history.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {prices.isPending ? (
                <Skeleton className='h-64 w-full' />
              ) : prices.isError ? (
                <p role='alert'>{t('securities.loadError')}</p>
              ) : prices.data.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                  {t('securities.history.empty')}
                </p>
              ) : (
                <div className='space-y-6'>
                  <PriceHistoryChart
                    prices={prices.data}
                    label={t('securities.history.chartLabel', {
                      name: security.data.name,
                    })}
                  />
                  <PriceTable prices={prices.data} />
                </div>
              )}
            </CardContent>
          </Card>
          <Profile security={security.data} />
        </div>
      )}
    </PageShell>
  )
}

function CompanyHeader({ security }: { security: Security }) {
  const { t, i18n } = useTranslation()
  const sector =
    i18n.language === 'en' ? security.sector.nameEn : security.sector.nameFr
  const country = new Intl.DisplayNames([i18n.language], {
    type: 'region',
  }).of(security.country)

  return (
    <header className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='secondary' className='font-mono'>
          {security.ticker}
        </Badge>
        <span className='text-muted-foreground text-sm'>
          {sector} · {country}
        </span>
      </div>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
          {security.name}
        </h1>
        <WatchButton ticker={security.ticker} />
      </div>
      {security.latestPrice ? (
        <div className='space-y-1'>
          <p className='text-3xl font-semibold tabular-nums'>
            {formatXof(security.latestPrice.close, i18n.language)}
          </p>
          <AsOfLabel date={security.latestPrice.date} />
        </div>
      ) : (
        <p className='text-muted-foreground text-sm'>
          {t('securities.noPrice')}
        </p>
      )}
    </header>
  )
}

/** The same data as the chart, readable without it; newest first. */
function PriceTable({ prices }: { prices: EndOfDayPrice[] }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('securities.history.date')}</TableHead>
          <TableHead className='text-right'>
            {t('securities.history.close')}
          </TableHead>
          <TableHead className='text-right'>
            {t('securities.history.volume')}
          </TableHead>
          <TableHead>{t('securities.history.source')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prices
          .slice()
          .reverse()
          .map((price) => (
            <TableRow key={price.date}>
              <TableCell>{formatShortDate(price.date, lang)}</TableCell>
              <TableCell className='text-right tabular-nums'>
                {formatXof(price.close, lang)}
              </TableCell>
              <TableCell className='text-right tabular-nums'>
                {price.volume ? formatQuantity(price.volume, lang) : '—'}
              </TableCell>
              <TableCell>
                <SourceLink price={price} />
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  )
}

function SourceLink({ price }: { price: EndOfDayPrice }) {
  const { t, i18n } = useTranslation()
  const text = t('securities.history.sourceLabel', {
    date: formatShortDate(price.publishedOn, i18n.language),
  })
  return /^https?:\/\//.test(price.sourceDocument) ? (
    <a
      href={price.sourceDocument}
      target='_blank'
      rel='noreferrer'
      className='text-primary underline-offset-4 hover:underline'
    >
      {text}
    </a>
  ) : (
    <span title={price.sourceDocument}>{text}</span>
  )
}

/** The profile in the active language, marked when it is a translation. */
function Profile({ security }: { security: Security }) {
  const { t, i18n } = useTranslation()
  const profiles = { fr: security.profileFr, en: security.profileEn }
  const preferred = i18n.language === 'en' ? 'en' : 'fr'
  // Fall back to the other language when there is no text in this one.
  const shownLanguage = profiles[preferred]
    ? preferred
    : preferred === 'en'
      ? 'fr'
      : 'en'
  const text = profiles[shownLanguage]
  if (!text) return null

  const isTranslation = shownLanguage !== security.profileOriginalLanguage

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('securities.profile.title')}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <p lang={shownLanguage} className='leading-relaxed'>
          {text}
        </p>
        {isTranslation && (
          <p className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
            <IconLanguage aria-hidden='true' className='size-4' />
            <span>
              {t(
                `securities.profile.translatedFrom.${security.profileOriginalLanguage}`
              )}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
