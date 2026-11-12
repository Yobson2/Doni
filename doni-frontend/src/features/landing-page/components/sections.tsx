import { Link } from '@tanstack/react-router'
import {
  IconArrowDown,
  IconArrowRight,
  IconBuildingBank,
  IconCalendarEvent,
  IconChevronDown,
  IconCoins,
  IconFileCertificate,
  IconFileInvoice,
  IconInfoCircle,
  IconNews,
  IconShieldCheck,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { PositionPreview } from './position-preview'
import { Eyebrow, Reveal, SectionTitle } from './primitives'

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

export function Hero() {
  const { t } = useTranslation()

  return (
    <section aria-labelledby='hero-title' className='relative'>
      <div className='mx-auto grid max-w-7xl items-center gap-12 px-5 pt-10 pb-20 sm:px-8 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-20 lg:pb-28'>
        <Reveal>
          <Eyebrow>{t('landing.hero.eyebrow')}</Eyebrow>
          <h1
            id='hero-title'
            className='font-manrope mt-6 text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance sm:text-6xl lg:text-[4.25rem]'
          >
            {t('landing.hero.title1')}{' '}
            <span className='text-primary block'>
              {t('landing.hero.title2')}
            </span>
          </h1>
          <p className='text-text-secondary mt-6 max-w-xl text-lg leading-relaxed'>
            {t('landing.hero.subtitle')}
          </p>
          <div className='mt-9 flex flex-col gap-3 sm:flex-row sm:items-center'>
            <Button size='lg' asChild className='h-12 px-6 text-base'>
              <Link to='/sign-up'>
                {t('landing.nav.getStarted')}
                <IconArrowRight aria-hidden='true' />
              </Link>
            </Button>
            <Button
              size='lg'
              variant='ghost'
              asChild
              className='h-12 px-5 text-base'
            >
              <a href='#how-it-works'>
                {t('landing.hero.secondary')}
                <IconArrowDown aria-hidden='true' />
              </a>
            </Button>
          </div>
          <p className='text-muted-foreground mt-8 flex max-w-lg items-start gap-2 text-xs leading-relaxed'>
            <IconInfoCircle
              className='mt-px size-4 shrink-0'
              aria-hidden='true'
            />
            {t('landing.hero.note')}
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <PositionPreview />
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Problem                                                             */
/* ------------------------------------------------------------------ */

const problems = [
  { key: 'statements', icon: IconFileInvoice },
  { key: 'bulletin', icon: IconNews },
  { key: 'dividends', icon: IconCoins },
] as const

export function Problem() {
  const { t } = useTranslation()

  return (
    <section aria-labelledby='problem-title' className='py-20 sm:py-24'>
      <div className='mx-auto max-w-7xl px-5 sm:px-8'>
        <Reveal className='max-w-3xl'>
          <Eyebrow>{t('landing.problem.eyebrow')}</Eyebrow>
          <SectionTitle id='problem-title' className='mt-4'>
            {t('landing.problem.title')}
          </SectionTitle>
        </Reveal>
        <ul className='mt-12 grid gap-px overflow-hidden rounded-2xl border bg-[var(--border)] md:grid-cols-3'>
          {problems.map(({ key, icon: Icon }, i) => (
            <Reveal
              as='li'
              key={key}
              delay={i * 0.08}
              className='bg-background p-6 sm:p-8'
            >
              <Icon
                className='text-muted-foreground size-6'
                aria-hidden='true'
              />
              <h3 className='mt-5 font-semibold'>
                {t(`landing.problem.${key}.title`)}
              </h3>
              <p className='text-text-secondary mt-2 text-sm leading-relaxed'>
                {t(`landing.problem.${key}.description`)}
              </p>
            </Reveal>
          ))}
        </ul>
        <Reveal className='mt-10 flex items-center gap-3'>
          <Logo className='text-primary size-7 shrink-0' />
          <p className='font-manrope text-xl font-bold tracking-tight sm:text-2xl'>
            {t('landing.problem.answer')}
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const steps = ['step1', 'step2', 'step3'] as const

export function HowItWorks() {
  const { t } = useTranslation()

  return (
    <section
      id='how-it-works'
      aria-labelledby='how-title'
      className='scroll-mt-16 py-20 sm:py-28'
    >
      <div className='mx-auto max-w-7xl px-5 sm:px-8'>
        <Reveal className='max-w-3xl'>
          <Eyebrow>{t('landing.nav.how')}</Eyebrow>
          <SectionTitle id='how-title' className='mt-4'>
            {t('landing.how.subtitle')}
          </SectionTitle>
        </Reveal>

        <ol className='mt-14 grid gap-12 md:grid-cols-3 md:gap-8'>
          {steps.map((step, index) => (
            <Reveal
              as='li'
              key={step}
              delay={index * 0.12}
              className='flex gap-5 md:flex-col md:gap-0'
            >
              {/* Each step adds a block, like the stem of the logo: doni doni */}
              <div className='flex shrink-0 flex-col items-start md:h-28 md:flex-row md:items-end md:gap-6'>
                <div aria-hidden='true' className='flex flex-col-reverse gap-1'>
                  {Array.from({ length: index + 1 }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-5 w-6 rounded-[3px]',
                        i === index ? 'bg-highlight' : 'bg-primary'
                      )}
                    />
                  ))}
                </div>
                <span className='font-manrope text-muted-foreground mt-3 text-sm font-bold tabular-nums md:mt-0'>
                  0{index + 1}
                </span>
              </div>
              <div className='md:mt-6 md:border-t md:pt-6'>
                <h3 className='font-manrope text-xl font-bold tracking-tight'>
                  {t(`landing.how.${step}.title`)}
                </h3>
                <p className='text-text-secondary mt-2 leading-relaxed'>
                  {t(`landing.how.${step}.description`)}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Trust                                                               */
/* ------------------------------------------------------------------ */

const trustItems = [
  { key: 'source', icon: IconFileCertificate },
  { key: 'checked', icon: IconShieldCheck },
  { key: 'dated', icon: IconCalendarEvent },
  { key: 'yours', icon: IconBuildingBank },
] as const

export function Trust() {
  const { t } = useTranslation()

  return (
    <section
      id='trust'
      aria-labelledby='trust-title'
      className='bg-primary text-primary-foreground scroll-mt-16 py-20 sm:py-28'
    >
      <div className='mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12'>
        <Reveal className='lg:col-span-5'>
          <Eyebrow tone='inverse'>{t('landing.trust.eyebrow')}</Eyebrow>
          <SectionTitle id='trust-title' className='mt-4'>
            {t('landing.trust.title')}
          </SectionTitle>
          <p className='text-primary-foreground/80 mt-5 max-w-md text-lg'>
            {t('landing.trust.subtitle')}
          </p>
        </Reveal>
        <ul className='grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-7'>
          {trustItems.map(({ key, icon: Icon }, i) => (
            <Reveal
              as='li'
              key={key}
              delay={i * 0.08}
              className='border-primary-foreground/20 border-t pt-6'
            >
              <Icon className='size-6' aria-hidden='true' />
              <h3 className='mt-4 font-semibold'>
                {t(`landing.trust.${key}.title`)}
              </h3>
              <p className='text-primary-foreground/80 mt-2 text-sm leading-relaxed'>
                {t(`landing.trust.${key}.description`)}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* FAQ: native <details> keeps it keyboard- and screen-reader-friendly */
/* ------------------------------------------------------------------ */

const faqs = ['broker', 'advice', 'live', 'privacy', 'countries'] as const

export function Faq() {
  const { t } = useTranslation()

  return (
    <section
      id='faq'
      aria-labelledby='faq-title'
      className='scroll-mt-16 py-20 sm:py-28'
    >
      <div className='mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12'>
        <Reveal className='lg:col-span-4'>
          <Eyebrow>{t('landing.nav.faq')}</Eyebrow>
          <SectionTitle id='faq-title' className='mt-4'>
            {t('landing.faq.title')}
          </SectionTitle>
          <p className='text-text-secondary mt-5'>
            {t('landing.faq.subtitle')}
          </p>
        </Reveal>
        <Reveal className='lg:col-span-8' delay={0.1}>
          <div className='border-t'>
            {faqs.map((faq) => (
              <details key={faq} className='group border-b'>
                <summary className='hover:text-primary flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-semibold transition-colors [&::-webkit-details-marker]:hidden'>
                  {t(`landing.faq.${faq}.q`)}
                  <IconChevronDown
                    aria-hidden='true'
                    className='text-muted-foreground size-5 shrink-0 transition-transform duration-200 group-open:rotate-180'
                  />
                </summary>
                <p className='text-text-secondary max-w-2xl pb-6 leading-relaxed'>
                  {t(`landing.faq.${faq}.a`)}
                </p>
              </details>
            ))}
          </div>
          <p className='text-muted-foreground mt-6 text-sm'>
            {t('landing.faq.more')}
          </p>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

export function FinalCta() {
  const { t } = useTranslation()

  return (
    <section aria-labelledby='cta-title' className='pb-20 sm:pb-28'>
      <div className='mx-auto max-w-7xl px-5 sm:px-8'>
        <Reveal className='bg-card relative overflow-hidden rounded-3xl border px-6 py-14 sm:px-12 sm:py-16'>
          <Logo
            accent='var(--highlight)'
            className='text-secondary pointer-events-none absolute -right-6 -bottom-10 hidden size-72 md:block'
          />
          <div className='relative max-w-xl'>
            <Eyebrow>{t('landing.cta.eyebrow')}</Eyebrow>
            <SectionTitle id='cta-title' className='mt-4'>
              {t('landing.cta.title')}
            </SectionTitle>
            <p className='text-text-secondary mt-4 text-lg'>
              {t('landing.cta.subtitle')}
            </p>
            <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
              <Button size='lg' asChild className='h-12 px-6 text-base'>
                <Link to='/sign-up'>
                  {t('landing.nav.getStarted')}
                  <IconArrowRight aria-hidden='true' />
                </Link>
              </Button>
              <Button
                size='lg'
                variant='outline'
                asChild
                className='h-12 px-6 text-base'
              >
                <Link to='/sign-in'>{t('landing.nav.signIn')}</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
