import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Fades content in once it scrolls into view. Transforms are skipped under
 * prefers-reduced-motion (the landing page wraps everything in
 * <MotionConfig reducedMotion='user'>).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = 'div',
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  as?: 'div' | 'li'
}) {
  const Comp = as === 'li' ? motion.li : motion.div
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Comp>
  )
}

/** Small label above section titles; the block echoes the logo's top block. */
export function Eyebrow({
  children,
  className,
  tone = 'default',
}: {
  children: React.ReactNode
  className?: string
  tone?: 'default' | 'inverse'
}) {
  return (
    <p
      className={cn(
        'flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase',
        tone === 'inverse'
          ? 'text-primary-foreground/80'
          : 'text-text-secondary',
        className
      )}
    >
      <span aria-hidden='true' className='bg-highlight size-2 rounded-[2px]' />
      {children}
    </p>
  )
}

export function SectionTitle({
  children,
  className,
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <h2
      id={id}
      className={cn(
        'font-manrope text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]',
        className
      )}
    >
      {children}
    </h2>
  )
}

/** Small pill marking figures as an example rather than market data. */
export function IllustrativeTag({ children }: { children: React.ReactNode }) {
  return (
    <span className='bg-muted text-text-secondary inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium'>
      {children}
    </span>
  )
}
