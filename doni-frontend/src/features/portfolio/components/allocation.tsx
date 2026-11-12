import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { PortfolioValuation } from '../api'
import { formatPercent } from '../format'
import { useMoney } from '../use-money'

type Allocation = PortfolioValuation['allocation']

const VIEWS = ['bySecurity', 'bySector'] as const
type View = (typeof VIEWS)[number]

interface Bar {
  key: string
  label: string
  detail?: string
  marketValue: string
  percent: string
}

/**
 * How the portfolio's market value is spread, by security or by sector, as
 * a list of bars: one series, so one colour, every bar labelled with its
 * share and value. The percentages come rounded from the API and add up to
 * exactly 100. Positions without a closing price are named, not hidden.
 */
export function AllocationCard({ allocation }: { allocation: Allocation }) {
  const { t, i18n } = useTranslation()
  const [view, setView] = useState<View>('bySecurity')
  const sectorName = (s: Allocation['bySector'][number]) =>
    i18n.language.startsWith('en') ? s.nameEn : s.nameFr

  const bars: Bar[] =
    view === 'bySecurity'
      ? allocation.bySecurity.map((s) => ({
          key: s.ticker,
          label: s.ticker,
          detail: s.name,
          marketValue: s.marketValue,
          percent: s.percent,
        }))
      : allocation.bySector.map((s) => ({
          key: s.code,
          label: sectorName(s),
          marketValue: s.marketValue,
          percent: s.percent,
        }))

  return (
    <Card>
      <section aria-labelledby='allocation-title'>
        <CardHeader className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1.5'>
            <CardTitle>
              <h2 id='allocation-title'>{t('portfolio.allocation.title')}</h2>
            </CardTitle>
            <CardDescription>
              {t('portfolio.allocation.description')}
            </CardDescription>
          </div>
          <div
            role='group'
            aria-label={t('portfolio.allocation.view')}
            className='flex gap-1'
          >
            {VIEWS.map((v) => (
              <Button
                key={v}
                size='sm'
                variant={v === view ? 'secondary' : 'ghost'}
                aria-pressed={v === view}
                onClick={() => setView(v)}
              >
                {t(`portfolio.allocation.${v}`)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {bars.length === 0 ? (
            <p className='text-muted-foreground py-4 text-center text-sm'>
              {t('portfolio.allocation.empty')}
            </p>
          ) : (
            <ul className='space-y-3'>
              {bars.map((bar) => (
                <AllocationBar key={bar.key} bar={bar} />
              ))}
            </ul>
          )}
          {allocation.unpriced.length > 0 && (
            <p className='text-muted-foreground text-sm'>
              {t('portfolio.allocation.unpriced', {
                tickers: allocation.unpriced.map((p) => p.ticker).join(', '),
              })}
            </p>
          )}
        </CardContent>
      </section>
    </Card>
  )
}

function AllocationBar({ bar }: { bar: Bar }) {
  const { i18n } = useTranslation()
  const money = useMoney()
  return (
    <li className='space-y-1'>
      <div className='flex items-baseline justify-between gap-3 text-sm'>
        <span className='min-w-0 truncate'>
          <span className={bar.detail ? 'font-mono font-medium' : undefined}>
            {bar.label}
          </span>
          {bar.detail && (
            <span className='text-muted-foreground ml-2 text-xs'>
              {bar.detail}
            </span>
          )}
        </span>
        <span className='shrink-0 tabular-nums'>
          <span className='font-semibold'>
            {formatPercent(bar.percent, i18n.language)}
          </span>
          <span className='text-muted-foreground ml-2 text-xs'>
            {money.amount(bar.marketValue)}
          </span>
        </span>
      </div>
      <div aria-hidden='true' className='bg-muted h-2 rounded-full'>
        <div
          className='bg-primary h-2 rounded-full'
          style={{ width: `${bar.percent}%` }}
        />
      </div>
    </li>
  )
}
