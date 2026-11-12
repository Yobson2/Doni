import { useId, useState } from 'react'
import {
  IconBell,
  IconBriefcase,
  IconCalendarEvent,
  IconChartCandle,
  IconChartLine,
  IconCheck,
  IconCoins,
  IconCurrencyEuro,
  IconSparkles,
  IconTriangleFilled,
  IconTriangleInvertedFilled,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  computePosition,
  type Currency,
  EXAMPLE_POSITION,
  type PositionInput,
  useFormatters,
} from '../lib/position'
import { Eyebrow, IllustrativeTag, Reveal, SectionTitle } from './primitives'

const moreFeatures = [
  { key: 'market', icon: IconChartCandle },
  { key: 'alerts', icon: IconBell },
  { key: 'currency', icon: IconCurrencyEuro },
] as const

export function ProductSection() {
  const { t } = useTranslation()
  // Shared by the calculator and the return breakdown so both tell one story.
  const [position, setPosition] = useState<PositionInput>(EXAMPLE_POSITION)

  return (
    <section
      id='product'
      aria-labelledby='product-title'
      className='bg-card scroll-mt-16 border-y py-20 sm:py-28'
    >
      <div className='mx-auto max-w-7xl px-5 sm:px-8'>
        <Reveal className='max-w-3xl'>
          <Eyebrow>{t('landing.features.eyebrow')}</Eyebrow>
          <SectionTitle id='product-title' className='mt-4'>
            {t('landing.features.title')}
          </SectionTitle>
          <p className='text-text-secondary mt-5 max-w-2xl text-lg'>
            {t('landing.features.subtitle')}
          </p>
        </Reveal>

        {/* 1. Portfolio tracking + live calculator */}
        <div className='mt-16 grid gap-10 lg:mt-20 lg:grid-cols-12 lg:gap-12'>
          <Reveal className='lg:col-span-4 lg:pt-6'>
            <FeatureText icon={IconBriefcase} k='portfolio' />
          </Reveal>
          <Reveal className='lg:col-span-8' delay={0.1}>
            <Calculator position={position} onChange={setPosition} />
          </Reveal>
        </div>

        {/* 2. Dividends + 3. Real return */}
        <div className='mt-16 grid gap-12 lg:mt-24 lg:grid-cols-2 lg:gap-12'>
          <Reveal className='flex flex-col gap-8'>
            <FeatureText icon={IconCoins} k='dividends' />
            <DividendFlow className='mt-auto' />
          </Reveal>
          <Reveal className='flex flex-col gap-8' delay={0.1}>
            <FeatureText icon={IconChartLine} k='returns' />
            <ReturnBreakdown position={position} className='mt-auto' />
          </Reveal>
        </div>

        {/* Secondary features: a quiet list, not more cards */}
        <div className='mt-20 lg:mt-28'>
          <Reveal>
            <h3 className='font-manrope text-xl font-bold tracking-tight'>
              {t('landing.features.moreTitle')}
            </h3>
          </Reveal>
          <ul className='mt-8 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3'>
            {moreFeatures.map(({ key, icon: Icon }, i) => (
              <Reveal
                as='li'
                key={key}
                delay={i * 0.08}
                className='border-t pt-6'
              >
                <Icon className='text-primary size-6' aria-hidden='true' />
                <h4 className='mt-4 font-semibold'>
                  {t(`landing.features.${key}.title`)}
                </h4>
                <p className='text-text-secondary mt-2 text-sm leading-relaxed'>
                  {t(`landing.features.${key}.description`)}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function FeatureText({
  icon: Icon,
  k,
}: {
  icon: typeof IconBriefcase
  k: 'portfolio' | 'dividends' | 'returns'
}) {
  const { t } = useTranslation()
  return (
    <div>
      <span className='bg-secondary text-secondary-foreground inline-flex size-10 items-center justify-center rounded-lg'>
        <Icon className='size-5' aria-hidden='true' />
      </span>
      <h3 className='font-manrope mt-5 text-2xl font-bold tracking-tight'>
        {t(`landing.features.${k}.title`)}
      </h3>
      <p className='text-text-secondary mt-3 max-w-md leading-relaxed'>
        {t(`landing.features.${k}.description`)}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Calculator                                                          */
/* ------------------------------------------------------------------ */

function Calculator({
  position,
  onChange,
}: {
  position: PositionInput
  onChange: (p: PositionInput) => void
}) {
  const { t } = useTranslation()
  const { money, percent } = useFormatters()
  const [currency, setCurrency] = useState<Currency>('XOF')
  const r = computePosition(position)
  const id = useId()

  const setBuy = (index: number, field: 'quantity' | 'price', value: number) =>
    onChange({
      ...position,
      buys: position.buys.map((b, i) =>
        i === index ? { ...b, [field]: value } : b
      ),
    })

  return (
    <div className='bg-background overflow-hidden rounded-2xl border'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6'>
        <div>
          <p className='font-semibold'>{t('landing.demo.title')}</p>
          <p className='text-muted-foreground text-sm'>
            {t('landing.demo.hint')}
          </p>
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      <div className='grid md:grid-cols-[1.05fr_1fr]'>
        {/* Inputs */}
        <div className='flex flex-col gap-6 p-5 sm:p-6'>
          {position.buys.map((buy, i) => (
            <fieldset key={i} className='grid grid-cols-2 gap-3'>
              <legend className='mb-2 flex items-center gap-2 text-sm font-medium'>
                <span
                  aria-hidden='true'
                  className='bg-primary h-3 w-2 rounded-[2px]'
                />
                {t(i === 0 ? 'landing.demo.buy1' : 'landing.demo.buy2')}
              </legend>
              <NumberField
                id={`${id}-q${i}`}
                label={t('landing.demo.quantity')}
                value={buy.quantity}
                onChange={(v) => setBuy(i, 'quantity', v)}
                max={100_000}
              />
              <NumberField
                id={`${id}-p${i}`}
                label={t('landing.demo.price')}
                suffix='FCFA'
                value={buy.price}
                onChange={(v) => setBuy(i, 'price', v)}
                max={10_000_000}
                step={5}
              />
            </fieldset>
          ))}

          <NumberField
            id={`${id}-div`}
            label={t('landing.demo.dividend')}
            suffix='FCFA'
            value={position.dividendPerShare}
            onChange={(v) => onChange({ ...position, dividendPerShare: v })}
            max={1_000_000}
          />

          <div>
            <div className='flex items-baseline justify-between gap-3'>
              <label htmlFor={`${id}-close`} className='text-sm font-medium'>
                {t('landing.demo.lastClose')}
              </label>
              <span className='text-sm font-semibold tabular-nums'>
                {money(position.lastClose)}
              </span>
            </div>
            <input
              id={`${id}-close`}
              type='range'
              min={10_000}
              max={25_000}
              step={100}
              value={position.lastClose}
              onChange={(e) =>
                onChange({ ...position, lastClose: Number(e.target.value) })
              }
              className='accent-primary mt-3 h-6 w-full cursor-pointer'
            />
          </div>
        </div>

        {/* Results */}
        <div className='bg-muted/50 border-t p-5 sm:p-6 md:border-t-0 md:border-l'>
          <p className='text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase'>
            {t('landing.demo.results')}
          </p>
          <dl aria-live='polite' className='mt-4 divide-y'>
            <Row label={t('landing.demo.shares')} value={String(r.shares)} />
            <Row
              label={t('landing.demo.invested')}
              value={money(r.invested, currency)}
            />
            <Row
              label={t('landing.demo.avgCost')}
              value={money(r.avgCost, currency)}
              strong
            />
            <Row
              label={t('landing.demo.value')}
              value={money(r.value, currency)}
            />
            <Row
              label={t('landing.demo.unrealised')}
              value={money(r.unrealised, currency, true)}
              sub={percent(r.unrealisedPct)}
              trend={r.unrealised}
            />
            <Row
              label={t('landing.demo.dividends')}
              value={money(r.dividends, currency)}
            />
          </dl>
          <div className='bg-card mt-4 rounded-xl border p-4'>
            <p className='text-muted-foreground text-xs'>
              {t('landing.demo.totalReturn')}
            </p>
            <p
              className={cn(
                'font-manrope mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums',
                trendClass(r.totalReturnPct)
              )}
            >
              <TrendIcon value={r.totalReturnPct} className='size-4' />
              {percent(r.totalReturnPct)}
            </p>
          </div>
        </div>
      </div>

      <div className='text-muted-foreground border-t px-5 py-3 text-xs leading-relaxed sm:px-6'>
        {t('landing.demo.note')} {currency === 'EUR' && t('landing.demo.peg')}
      </div>
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  max,
  step = 1,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  max: number
  step?: number
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <label htmlFor={id} className='text-muted-foreground text-xs'>
        {label}
      </label>
      <div className='relative'>
        <Input
          id={id}
          type='number'
          inputMode='numeric'
          min={0}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => {
            const n = Math.min(Math.max(Number(e.target.value) || 0, 0), max)
            onChange(n)
          }}
          className={cn('bg-card h-11 tabular-nums', suffix && 'pr-14')}
        />
        {suffix && (
          <span
            aria-hidden='true'
            className='text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs'
          >
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

function CurrencyToggle({
  value,
  onChange,
}: {
  value: Currency
  onChange: (c: Currency) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      role='group'
      aria-label={t('landing.demo.currency')}
      className='inline-flex rounded-md border p-0.5'
    >
      {(['XOF', 'EUR'] as const).map((c) => (
        <button
          key={c}
          type='button'
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className={cn(
            'h-8 min-w-14 rounded-[5px] px-3 text-xs font-semibold transition-colors',
            value === c
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {c === 'XOF' ? 'FCFA' : 'EUR'}
        </button>
      ))}
    </div>
  )
}

function Row({
  label,
  value,
  sub,
  strong,
  trend,
}: {
  label: string
  value: string
  sub?: string
  strong?: boolean
  trend?: number
}) {
  return (
    <div className='flex items-baseline justify-between gap-4 py-2.5'>
      <dt className='text-text-secondary text-sm'>{label}</dt>
      <dd
        className={cn(
          'flex items-center gap-1.5 text-right text-sm tabular-nums',
          strong ? 'font-semibold' : 'font-medium',
          trend !== undefined && trendClass(trend)
        )}
      >
        {trend !== undefined && (
          <TrendIcon value={trend} className='size-2.5' />
        )}
        <span>
          {value}
          {sub && (
            <span className='text-muted-foreground ml-1.5 text-xs font-normal'>
              ({sub})
            </span>
          )}
        </span>
      </dd>
    </div>
  )
}

const trendClass = (n: number) =>
  n > 0 ? 'text-gain' : n < 0 ? 'text-loss' : undefined

/** Market colour is never used alone: always paired with ▲ / ▼ and a sign. */
function TrendIcon({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  if (value > 0)
    return (
      <IconTriangleFilled
        className={cn('shrink-0', className)}
        aria-hidden='true'
      />
    )
  if (value < 0)
    return (
      <IconTriangleInvertedFilled
        className={cn('shrink-0', className)}
        aria-hidden='true'
      />
    )
  return null
}

/* ------------------------------------------------------------------ */
/* Dividend flow                                                       */
/* ------------------------------------------------------------------ */

function DividendFlow({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { money } = useFormatters()
  const [confirmed, setConfirmed] = useState(false)

  const steps = [
    {
      icon: IconCalendarEvent,
      label: t('landing.dividendFlow.exDate'),
      text: t('landing.dividendFlow.exDateText'),
    },
    {
      icon: IconSparkles,
      label: t('landing.dividendFlow.suggested'),
      text: `${t('landing.dividendFlow.suggestedText')} = ${money(27_000)}`,
    },
  ]

  return (
    <figure
      aria-label={t('landing.dividendFlow.label')}
      className={cn('bg-background rounded-2xl border p-5 sm:p-6', className)}
    >
      <div className='mb-5 flex justify-end'>
        <IllustrativeTag>
          {t('landing.dividendFlow.illustrative')}
        </IllustrativeTag>
      </div>
      <ol className='relative flex flex-col gap-5'>
        <span
          aria-hidden='true'
          className='bg-border absolute top-5 bottom-5 left-[19px] w-0.5'
        />
        {steps.map(({ icon: Icon, label, text }) => (
          <li key={label} className='relative flex items-center gap-4'>
            <span className='bg-card relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border'>
              <Icon className='text-primary size-5' aria-hidden='true' />
            </span>
            <span>
              <span className='text-muted-foreground block text-xs'>
                {label}
              </span>
              <span className='block text-sm font-medium tabular-nums'>
                {text}
              </span>
            </span>
          </li>
        ))}
        <li className='relative flex items-center gap-4'>
          <span
            className={cn(
              'relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors',
              confirmed
                ? 'bg-success border-success text-success-foreground'
                : 'bg-card text-primary'
            )}
          >
            <IconCheck className='size-5' aria-hidden='true' />
          </span>
          <button
            type='button'
            aria-pressed={confirmed}
            onClick={() => setConfirmed((c) => !c)}
            className={cn(
              'min-h-11 rounded-md border px-4 text-sm font-medium transition-colors',
              confirmed
                ? 'border-success/40 bg-success-subtle text-success'
                : 'bg-primary text-primary-foreground hover:bg-primary-hover border-transparent'
            )}
          >
            {confirmed
              ? t('landing.dividendFlow.confirmed')
              : t('landing.dividendFlow.confirm')}
          </button>
        </li>
      </ol>
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/* Return breakdown (follows the calculator)                           */
/* ------------------------------------------------------------------ */

function ReturnBreakdown({
  position,
  className,
}: {
  position: PositionInput
  className?: string
}) {
  const { t } = useTranslation()
  const { percent } = useFormatters()
  const r = computePosition(position)
  const scale = Math.abs(r.unrealisedPct) + Math.abs(r.dividendsPct) || 1
  const priceWidth = (Math.abs(r.unrealisedPct) / scale) * 100
  const divWidth = (Math.abs(r.dividendsPct) / scale) * 100

  return (
    <figure
      aria-label={t('landing.returnBreakdown.label')}
      className={cn('bg-background rounded-2xl border p-5 sm:p-6', className)}
    >
      <div className='mb-5 flex justify-end'>
        <IllustrativeTag>
          {t('landing.returnBreakdown.illustrative')}
        </IllustrativeTag>
      </div>
      <div className='flex items-end justify-between gap-4'>
        <div>
          <p className='text-muted-foreground text-xs'>
            {t('landing.returnBreakdown.total')}
          </p>
          <p
            className={cn(
              'font-manrope mt-1 flex items-center gap-2 text-4xl font-bold tabular-nums',
              trendClass(r.totalReturnPct)
            )}
          >
            <TrendIcon value={r.totalReturnPct} className='size-4' />
            {percent(r.totalReturnPct)}
          </p>
        </div>
      </div>

      <div
        aria-hidden='true'
        className='bg-muted mt-6 flex h-3 overflow-hidden rounded-full'
      >
        <span
          className={cn(
            'h-full transition-[width] duration-500',
            r.unrealised < 0 ? 'bg-loss' : 'bg-primary'
          )}
          style={{ width: `${priceWidth}%` }}
        />
        <span
          className='bg-highlight h-full transition-[width] duration-500'
          style={{ width: `${divWidth}%` }}
        />
      </div>

      <dl className='mt-4 grid grid-cols-2 gap-4 text-sm'>
        <div>
          <dt className='text-text-secondary flex items-center gap-2'>
            <span
              aria-hidden='true'
              className={cn(
                'size-2.5 rounded-[2px]',
                r.unrealised < 0 ? 'bg-loss' : 'bg-primary'
              )}
            />
            {t('landing.returnBreakdown.price')}
          </dt>
          <dd className='mt-1 font-semibold tabular-nums'>
            {percent(r.unrealisedPct)}
          </dd>
        </div>
        <div>
          <dt className='text-text-secondary flex items-center gap-2'>
            <span
              aria-hidden='true'
              className='bg-highlight size-2.5 rounded-[2px]'
            />
            {t('landing.returnBreakdown.dividends')}
          </dt>
          <dd className='mt-1 font-semibold tabular-nums'>
            {percent(r.dividendsPct)}
          </dd>
        </div>
      </dl>

      <p className='text-muted-foreground mt-5 border-t pt-4 text-xs'>
        {t('landing.returnBreakdown.benchmark')}
      </p>
    </figure>
  )
}
