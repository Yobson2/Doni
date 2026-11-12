import { IconCalendarEvent, IconTriangleFilled } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  computePosition,
  EXAMPLE_POSITION,
  useFormatters,
} from '../lib/position'
import { IllustrativeTag } from './primitives'

/**
 * Hero product preview: a position built "doni doni" from its operations.
 * Rows stack upward like the logo's stem; the newest sits on top in ochre.
 */
export function PositionPreview({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { money, percent } = useFormatters()
  const p = computePosition(EXAMPLE_POSITION)
  const [b1, b2] = EXAMPLE_POSITION.buys

  // Chronological order; rendered bottom-up with flex-col-reverse.
  const ops = [
    {
      kind: t('landing.preview.buy'),
      detail: `${b1.quantity} × ${money(b1.price)}`,
      amount: money(b1.quantity * b1.price),
    },
    {
      kind: t('landing.preview.buy'),
      detail: `${b2.quantity} × ${money(b2.price)}`,
      amount: money(b2.quantity * b2.price),
    },
    {
      kind: t('landing.preview.dividend'),
      detail: `${p.shares} × ${money(EXAMPLE_POSITION.dividendPerShare)} ${t('landing.preview.net')}`,
      amount: money(p.dividends),
    },
  ]

  return (
    <figure
      aria-labelledby='position-preview-title'
      aria-describedby='position-preview-desc'
      className={cn(
        'bg-card text-card-foreground relative rounded-2xl border shadow-[0_1px_0_0_var(--border),0_24px_48px_-24px_oklch(0.237_0.033_278.4/0.25)]',
        className
      )}
    >
      <p id='position-preview-desc' className='sr-only'>
        {t('landing.preview.label')}
      </p>

      <header className='flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6'>
        <div>
          <p id='position-preview-title' className='text-sm font-semibold'>
            {t('landing.preview.title')}
          </p>
          <p className='text-muted-foreground text-xs tabular-nums'>
            {t('landing.preview.shares', { count: p.shares })}
          </p>
        </div>
        <IllustrativeTag>{t('landing.preview.illustrative')}</IllustrativeTag>
      </header>

      {/* Ledger: bottom-up, newest on top */}
      <ol className='flex flex-col-reverse px-5 py-3 sm:px-6'>
        {ops.map((op, i) => {
          const latest = i === ops.length - 1
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.35 + i * 0.35,
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
              }}
              className='grid grid-cols-[8px_1fr_auto] items-center gap-x-4 py-2.5'
            >
              <span
                aria-hidden='true'
                className={cn(
                  'h-9 w-2 rounded-[2px]',
                  latest ? 'bg-highlight' : 'bg-primary'
                )}
              />
              <span className='min-w-0'>
                <span className='block text-sm font-medium'>{op.kind}</span>
                <span className='text-muted-foreground block truncate text-xs tabular-nums'>
                  {op.detail}
                </span>
              </span>
              <span className='text-sm font-medium tabular-nums'>
                {op.amount}
              </span>
            </motion.li>
          )
        })}
      </ol>

      <motion.dl
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.45, duration: 0.5 }}
        className='grid grid-cols-2 gap-px overflow-hidden border-t bg-[var(--border)]'
      >
        <Metric label={t('landing.preview.avgCost')} value={money(p.avgCost)} />
        <Metric
          label={t('landing.preview.lastClose')}
          value={money(EXAMPLE_POSITION.lastClose)}
        />
        <Metric
          label={t('landing.preview.unrealised')}
          value={money(p.unrealised, 'XOF', true)}
          sub={percent(p.unrealisedPct)}
          gain
        />
        <Metric
          label={t('landing.preview.totalReturn')}
          value={percent(p.totalReturnPct)}
          sub={`${t('landing.preview.dividends')} ${money(p.dividends)}`}
          gain
          emphasis
        />
      </motion.dl>

      <footer className='text-muted-foreground flex items-center gap-2 rounded-b-2xl border-t px-5 py-3 text-xs sm:px-6'>
        <IconCalendarEvent className='size-4 shrink-0' aria-hidden='true' />
        <span>{t('landing.preview.source')}</span>
      </footer>
    </figure>
  )
}

function Metric({
  label,
  value,
  sub,
  gain,
  emphasis,
}: {
  label: string
  value: string
  sub?: string
  gain?: boolean
  emphasis?: boolean
}) {
  return (
    <div className='bg-card px-5 py-4 sm:px-6'>
      <dt className='text-muted-foreground text-xs'>{label}</dt>
      <dd
        className={cn(
          'mt-1 flex items-center gap-1.5 font-semibold tabular-nums',
          emphasis ? 'font-manrope text-2xl' : 'text-base',
          gain && 'text-gain'
        )}
      >
        {gain && (
          <IconTriangleFilled className='size-3 shrink-0' aria-hidden='true' />
        )}
        {value}
      </dd>
      {sub && (
        <dd className='text-muted-foreground mt-0.5 text-xs tabular-nums'>
          {sub}
        </dd>
      )}
    </div>
  )
}
