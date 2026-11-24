import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLongDate } from '@/features/securities/format'
import { type PortfolioReturns, type ReturnsPeriod, returnsQuery } from '../api'
import { formatReturn, signOf } from '../format'
import { ComparisonChart } from './comparison-chart'

const PERIODS: ReturnsPeriod[] = ['1M', '3M', 'YTD', '1Y', 'ALL']

const returnClass = (value: string) =>
  cn(
    'tabular-nums',
    signOf(value) > 0 && 'text-gain',
    signOf(value) < 0 && 'text-loss'
  )

/**
 * The portfolio's returns over a chosen period (ADR 0007): "Mon rendement"
 * (XIRR) and its TWR against the BRVM Composite. Every figure names its
 * method and period; days with data missing are listed, never filled in.
 */
export function ReturnsSection({ portfolioId }: { portfolioId: string }) {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<ReturnsPeriod>('ALL')
  const returns = useQuery(returnsQuery(portfolioId, period))

  return (
    <section aria-labelledby='returns-title' className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-1'>
          <h2 id='returns-title' className='text-xl font-semibold'>
            {t('portfolio.returns.title')}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {t('portfolio.returns.description')}
          </p>
        </div>
        <div
          role='group'
          aria-label={t('portfolio.returns.periodLabel')}
          className='flex flex-wrap gap-1'
        >
          {PERIODS.map((p) => (
            <Button
              key={p}
              size='sm'
              variant={p === period ? 'secondary' : 'ghost'}
              aria-pressed={p === period}
              onClick={() => setPeriod(p)}
            >
              {t(`portfolio.returns.period.${p}`)}
            </Button>
          ))}
        </div>
      </div>

      {returns.isPending ? (
        <Skeleton className='h-64 w-full' />
      ) : returns.isError ? (
        <p role='alert'>{t('portfolio.loadError')}</p>
      ) : returns.data.from === null || returns.data.to === null ? (
        <p className='text-muted-foreground text-sm'>
          {t('portfolio.returns.empty')}
        </p>
      ) : (
        <ReturnsView
          returns={returns.data}
          from={returns.data.from}
          to={returns.data.to}
        />
      )}
    </section>
  )
}

function ReturnsView({
  returns,
  from,
  to,
}: {
  returns: PortfolioReturns
  from: string
  to: string
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const range = t('portfolio.returns.range', {
    from: formatLongDate(from, lang),
    to: formatLongDate(to, lang),
  })
  const { xirr, comparison, gaps } = returns
  const benchmark = comparison.benchmark.name

  return (
    <div className='space-y-4'>
      {gaps.length > 0 && <GapsNotice returns={returns} />}
      <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
        <Card>
          <CardHeader>
            <CardTitle>
              <h3>{t('portfolio.returns.xirr.title')}</h3>
            </CardTitle>
            <CardDescription>{range}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {xirr.status === 'solved' && xirr.percent !== null ? (
              <p className='text-3xl font-semibold'>
                <span className={returnClass(xirr.percent)}>
                  {formatReturn(xirr.percent, lang)}
                </span>{' '}
                <span className='text-muted-foreground text-base font-normal'>
                  {t('portfolio.returns.xirr.perYear')}
                </span>
              </p>
            ) : (
              <p className='text-muted-foreground text-sm'>
                {t(`portfolio.returns.xirr.${xirr.status}`)}
              </p>
            )}
            <p className='text-muted-foreground text-sm'>
              {t('portfolio.returns.xirr.method')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h3>{t('portfolio.returns.comparison.title', { benchmark })}</h3>
            </CardTitle>
            <CardDescription>{range}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {comparison.points.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {t('portfolio.returns.comparison.empty')}
              </p>
            ) : (
              <>
                <Latest returns={returns} />
                <ComparisonChart
                  points={comparison.points}
                  label={t('portfolio.returns.comparison.chartLabel', {
                    benchmark,
                    from: formatLongDate(from, lang),
                    to: formatLongDate(to, lang),
                  })}
                />
              </>
            )}
            <p className='text-muted-foreground text-sm'>
              {t('portfolio.returns.comparison.method')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * The legend, with each series' latest value and the day it applies to: a
 * day with data missing has no value, so the latest may be an earlier day.
 */
function Latest({ returns }: { returns: PortfolioReturns }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { points, benchmark } = returns.comparison
  const series = [
    {
      key: 'portfolio' as const,
      name: t('portfolio.returns.comparison.portfolio'),
      swatch: 'border-chart-1 border-t-2',
    },
    {
      key: 'benchmark' as const,
      name: benchmark.name,
      swatch: 'border-muted-foreground border-t-2 border-dashed',
    },
  ]

  return (
    <dl className='flex flex-wrap gap-x-6 gap-y-2 text-sm'>
      {series.map(({ key, name, swatch }) => {
        const latest = [...points].reverse().find((p) => p[key] !== null)
        const value = latest?.[key] ?? null
        return (
          <div key={key} className='flex items-center gap-2'>
            <span aria-hidden className={cn('inline-block w-5', swatch)} />
            <dt className='text-muted-foreground'>{name}</dt>
            <dd className='font-medium'>
              {latest && value !== null ? (
                <span className={returnClass(value)}>
                  {t('portfolio.returns.comparison.latest', {
                    value: formatReturn(value, lang),
                    date: formatLongDate(latest.date, lang),
                  })}
                </span>
              ) : (
                t('portfolio.unknown')
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Days of the period with data missing, each with what is missing. */
function GapsNotice({ returns }: { returns: PortfolioReturns }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const benchmark = returns.comparison.benchmark.name

  return (
    <Alert>
      <TriangleAlert />
      <AlertTitle>{t('portfolio.returns.gaps.title')}</AlertTitle>
      <AlertDescription>
        <p>{t('portfolio.returns.gaps.description')}</p>
        <ul className='list-disc pl-5'>
          {returns.gaps.map((gap) => {
            const missing = [
              gap.tickers.length > 0 &&
                t('portfolio.returns.gaps.prices', {
                  tickers: gap.tickers.join(', '),
                }),
              gap.benchmark &&
                t('portfolio.returns.gaps.benchmark', { benchmark }),
            ].filter(Boolean)
            return (
              <li key={gap.date}>
                {t('portfolio.returns.gaps.day', {
                  date: formatLongDate(gap.date, lang),
                  missing: missing.join(t('portfolio.returns.gaps.separator')),
                })}
              </li>
            )
          })}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
