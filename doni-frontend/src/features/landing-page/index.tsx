import { Link } from '@tanstack/react-router'
import {
  IconChartLine,
  IconCoin,
  IconDeviceMobile,
  IconFileText,
  IconLanguage,
  IconWallet,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { AnimatedContainer } from '@/components/motion/animated-container'
import {
  StaggerContainer,
  StaggerItem,
} from '@/components/motion/stagger-container'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Copy lives in src/i18n/{fr,en}.json under `landing.*`.
const features = [
  { key: 'prices', icon: IconFileText },
  { key: 'portfolio', icon: IconWallet },
  { key: 'returns', icon: IconChartLine },
  { key: 'dividends', icon: IconCoin },
  { key: 'languages', icon: IconLanguage },
  { key: 'mobile', icon: IconDeviceMobile },
]

const faqs = ['advice', 'cost', 'data', 'orders']

export default function LandingPage() {
  const { t } = useTranslation()

  return (
    <div className='flex flex-col'>
      {/* Hero */}
      <section className='container mx-auto px-4 py-20 text-center sm:px-6 sm:py-32 lg:px-8'>
        <AnimatedContainer variant='fadeSlideUp'>
          <h1 className='text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl'>
            {t('landing.hero.title')}
            <br />
            <span className='text-primary'>{t('landing.hero.highlight')}</span>
          </h1>
          <p className='text-muted-foreground mx-auto mt-6 max-w-2xl text-lg'>
            {t('landing.hero.description')}
          </p>
          <div className='mt-10 flex items-center justify-center gap-4'>
            <Button size='lg' asChild>
              <Link to='/sign-up'>{t('landing.cta.getStarted')}</Link>
            </Button>
            <Button size='lg' variant='outline' asChild>
              <Link to='/sign-in'>{t('landing.cta.signIn')}</Link>
            </Button>
          </div>
        </AnimatedContainer>
      </section>

      {/* Features */}
      <section id='features' className='bg-muted/50 py-20 sm:py-24'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <AnimatedContainer variant='fadeSlideUp' className='text-center'>
            <h2 className='text-3xl font-bold tracking-tight sm:text-4xl'>
              {t('landing.features.title')}
            </h2>
            <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg'>
              {t('landing.features.description')}
            </p>
          </AnimatedContainer>
          <StaggerContainer className='mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {features.map((feature) => (
              <StaggerItem key={feature.key}>
                <Card className='h-full'>
                  <CardHeader>
                    <feature.icon className='text-primary mb-2 h-8 w-8' />
                    <CardTitle className='text-lg'>
                      {t(`landing.features.items.${feature.key}.title`)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className='text-sm'>
                      {t(`landing.features.items.${feature.key}.description`)}
                    </CardDescription>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* FAQ */}
      <section id='faq' className='py-20 sm:py-24'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <AnimatedContainer variant='fadeSlideUp' className='text-center'>
            <h2 className='text-3xl font-bold tracking-tight sm:text-4xl'>
              {t('landing.faq.title')}
            </h2>
            <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg'>
              {t('landing.faq.description')}
            </p>
          </AnimatedContainer>
          <AnimatedContainer
            variant='fadeSlideUp'
            delay={0.2}
            className='mx-auto mt-12 max-w-2xl'
          >
            <Accordion className='w-full'>
              {faqs.map((faq) => (
                <AccordionItem key={faq} value={faq}>
                  <AccordionTrigger className='text-left text-sm font-medium'>
                    {t(`landing.faq.items.${faq}.question`)}
                  </AccordionTrigger>
                  <AccordionContent className='text-muted-foreground text-sm'>
                    {t(`landing.faq.items.${faq}.answer`)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AnimatedContainer>
        </div>
      </section>

      {/* CTA */}
      <section className='bg-muted/50 py-20 sm:py-24'>
        <div className='container mx-auto px-4 text-center sm:px-6 lg:px-8'>
          <AnimatedContainer variant='fadeSlideUp'>
            <h2 className='text-3xl font-bold tracking-tight sm:text-4xl'>
              {t('landing.cta.title')}
            </h2>
            <p className='text-muted-foreground mx-auto mt-4 max-w-xl text-lg'>
              {t('landing.cta.description')}
            </p>
            <div className='mt-8 flex items-center justify-center gap-4'>
              <Button size='lg' asChild>
                <Link to='/sign-up'>{t('landing.cta.createAccount')}</Link>
              </Button>
              <Button size='lg' variant='outline' asChild>
                <Link to='/sign-in'>{t('landing.cta.signIn')}</Link>
              </Button>
            </div>
          </AnimatedContainer>
        </div>
      </section>
    </div>
  )
}
