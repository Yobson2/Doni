import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AsOfLabel } from '@/features/securities/components/as-of-label'
import { PageShell } from '@/features/securities/components/page-shell'
import {
  formatLongDate,
  formatQuantity,
  formatShortDate,
  formatXof,
} from '@/features/securities/format'
import {
  type Portfolio,
  type PortfolioValuation,
  entriesQuery,
  portfoliosQuery,
  valuationQuery,
} from './api'
import { CreatePortfolio } from './components/create-portfolio'
import { EntryForm } from './components/entry-form'
import { ENTRY_MODES, type EntryMode } from './components/form-fields'
import { Onboarding } from './components/onboarding'
import { OpeningPositionForm } from './components/opening-position-form'
import { formatGain, formatPmp, signOf } from './format'

const gainClass = (value: string) =>
  cn(
    'tabular-nums',
    signOf(value) > 0 && 'text-gain',
    signOf(value) < 0 && 'text-loss'
  )

/**
 * The user's portfolio: positions derived from the ledger and valued at the
 * latest end-of-day prices, always with the date those prices apply to.
 */
export function PortfolioPage() {
  const { t } = useTranslation()
  const portfolios = useQuery(portfoliosQuery())

  return (
    <PageShell>
      {portfolios.isPending ? (
        <Skeleton className='h-64 w-full' />
      ) : portfolios.isError ? (
        <p role='alert'>{t('portfolio.loadError')}</p>
      ) : portfolios.data.length === 0 ? (
        <CreatePortfolio />
      ) : (
        <PortfolioView portfolio={portfolios.data[0]} />
      )}
    </PageShell>
  )
}

function PortfolioView({ portfolio }: { portfolio: Portfolio }) {
  const { t } = useTranslation()
  const valuation = useQuery(valuationQuery(portfolio.id))

  return (
    <div className='space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>{portfolio.name}</h1>
        <p className='text-muted-foreground'>{t('portfolio.description')}</p>
      </div>

      {valuation.isPending ? (
        <Skeleton className='h-48 w-full' />
      ) : valuation.isError ? (
        <p role='alert'>{t('portfolio.loadError')}</p>
      ) : (
        <>
          <Totals valuation={valuation.data} />
          <Positions valuation={valuation.data} />
        </>
      )}

      <Ledger portfolioId={portfolio.id} />
    </div>
  )
}

/**
 * Records ledger entries and lists them. An empty portfolio first asks how
 * to start: opening positions first, the full trade history second.
 */
function Ledger({ portfolioId }: { portfolioId: string }) {
  const { t } = useTranslation()
  const entries = useQuery(entriesQuery(portfolioId))
  const [chosen, setChosen] = useState<EntryMode | null>(null)

  if (entries.isPending) return <Skeleton className='h-48 w-full' />
  if (entries.data?.length === 0 && chosen === null) {
    return <Onboarding onChoose={setChosen} />
  }

  const mode = chosen ?? 'trade'
  return (
    <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'>
      <div className='space-y-3'>
        <div
          role='group'
          aria-label={t('portfolio.mode.label')}
          className='flex flex-wrap gap-2'
        >
          {ENTRY_MODES.map((m) => (
            <Button
              key={m}
              size='sm'
              variant={m === mode ? 'secondary' : 'ghost'}
              aria-pressed={m === mode}
              onClick={() => setChosen(m)}
            >
              {t(`portfolio.mode.${m}`)}
            </Button>
          ))}
        </div>
        {mode === 'opening' ? (
          <OpeningPositionForm portfolioId={portfolioId} />
        ) : (
          <EntryForm portfolioId={portfolioId} />
        )}
      </div>
      <Entries portfolioId={portfolioId} />
    </div>
  )
}

/** The most recent price date among valued positions. */
function latestPriceDate(valuation: PortfolioValuation): string | null {
  const dates = valuation.positions
    .map((p) => p.valuation?.priceDate)
    .filter((d): d is string => Boolean(d))
    .sort()
  return dates.at(-1) ?? null
}

function Totals({ valuation }: { valuation: PortfolioValuation }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { totals } = valuation
  const asOf = latestPriceDate(valuation)
  const unknown = t('portfolio.unknown')

  const tiles = [
    {
      label: t('portfolio.totals.marketValue'),
      value: totals.marketValue ? formatXof(totals.marketValue, lang) : unknown,
    },
    {
      label: t('portfolio.totals.unrealisedGain'),
      value: totals.unrealisedGain
        ? formatGain(totals.unrealisedGain, lang)
        : unknown,
      className: totals.unrealisedGain
        ? gainClass(totals.unrealisedGain)
        : undefined,
    },
    {
      label: t('portfolio.totals.realisedGain'),
      value: formatGain(totals.realisedGain, lang),
      className: gainClass(totals.realisedGain),
    },
    {
      label: t('portfolio.totals.costBasis'),
      value: formatXof(totals.costBasis, lang),
    },
  ]

  return (
    <section aria-label={t('portfolio.totals.title')} className='space-y-3'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {tiles.map((tile) => (
          <Card key={tile.label} className='gap-2 py-4'>
            <CardContent className='space-y-1 px-4'>
              <p className='text-muted-foreground text-sm'>{tile.label}</p>
              <p
                className={cn(
                  'text-xl font-semibold tabular-nums',
                  tile.className
                )}
              >
                {tile.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      {asOf && <AsOfLabel date={asOf} />}
      {valuation.performanceSince && (
        <p className='text-muted-foreground text-sm'>
          {t('portfolio.performanceSince', {
            date: formatLongDate(valuation.performanceSince, lang),
          })}
        </p>
      )}
      {totals.marketValue === null && (
        <p className='text-muted-foreground text-sm'>
          {t('portfolio.missingPrice')}
        </p>
      )}
    </section>
  )
}

function Positions({ valuation }: { valuation: PortfolioValuation }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('portfolio.positions.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {valuation.positions.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>
            {t('portfolio.positions.empty')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('portfolio.positions.security')}</TableHead>
                <TableHead className='text-right'>
                  {t('portfolio.positions.quantity')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('portfolio.positions.pmp')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('portfolio.positions.price')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('portfolio.positions.marketValue')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('portfolio.positions.unrealisedGain')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('portfolio.positions.realisedGain')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {valuation.positions.map((position) => {
                const closed = position.quantity === '0'
                const v = position.valuation
                return (
                  <TableRow
                    key={position.ticker}
                    className={cn(closed && 'text-muted-foreground')}
                  >
                    <TableCell>
                      <span className='font-mono font-medium'>
                        {position.ticker}
                      </span>
                      <span className='text-muted-foreground block max-w-48 truncate text-xs'>
                        {closed
                          ? t('portfolio.positions.closed')
                          : position.name}
                      </span>
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {formatQuantity(position.quantity, lang)}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {closed ? '—' : formatPmp(position.pmp, lang)}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {v ? (
                        <>
                          {formatXof(v.price, lang)}
                          <span className='text-muted-foreground block text-xs'>
                            {t('portfolio.positions.asOf', {
                              date: formatShortDate(v.priceDate, lang),
                            })}
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {v ? formatXof(v.marketValue, lang) : '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right',
                        v && gainClass(v.unrealisedGain)
                      )}
                    >
                      {v ? formatGain(v.unrealisedGain, lang) : '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right',
                        gainClass(position.realisedGain)
                      )}
                    >
                      {formatGain(position.realisedGain, lang)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function Entries({ portfolioId }: { portfolioId: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const entries = useQuery(entriesQuery(portfolioId))

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('portfolio.entries.title')}</h2>
        </CardTitle>
        <CardDescription>{t('portfolio.entries.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.isPending ? (
          <Skeleton className='h-32 w-full' />
        ) : entries.isError ? (
          <p role='alert'>{t('portfolio.loadError')}</p>
        ) : entries.data.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>
            {t('portfolio.entries.empty')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('portfolio.entries.date')}</TableHead>
                <TableHead>{t('portfolio.entries.kind')}</TableHead>
                <TableHead>{t('portfolio.entries.security')}</TableHead>
                <TableHead className='text-right'>
                  {t('portfolio.entries.quantity')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('portfolio.entries.price')}
                </TableHead>
                <TableHead className='text-right'>
                  {t('portfolio.entries.fees')}
                </TableHead>
                <TableHead>{t('portfolio.entries.sgi')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.data.map((entry) => {
                // An opening position's price is its PMP, fees included.
                const opening = entry.kind === 'opening_position'
                return (
                  <TableRow key={entry.id}>
                    <TableCell className='tabular-nums'>
                      {formatShortDate(entry.date, lang)}
                    </TableCell>
                    <TableCell>{t(`portfolio.kind.${entry.kind}`)}</TableCell>
                    <TableCell className='font-mono'>{entry.ticker}</TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {formatQuantity(entry.quantity, lang)}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {opening ? (
                        <>
                          {formatPmp(entry.price, lang)}
                          <span className='text-muted-foreground block text-xs'>
                            {t('portfolio.entries.pmp')}
                          </span>
                        </>
                      ) : (
                        formatXof(entry.price, lang)
                      )}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {opening ? '—' : formatXof(entry.fees, lang)}
                    </TableCell>
                    <TableCell>{entry.sgi}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
