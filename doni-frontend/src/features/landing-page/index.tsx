import { Link } from '@tanstack/react-router'
import {
  IconShieldLock,
  IconPalette,
  IconTable,
  IconSettings,
  IconLanguage,
  IconDeviceMobile,
} from '@tabler/icons-react'
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

const features = [
  {
    icon: IconShieldLock,
    title: 'Authentication',
    description:
      'Complete auth flow with sign-in, sign-up, forgot password, and OTP verification.',
  },
  {
    icon: IconTable,
    title: 'Data Tables',
    description:
      'Feature-rich tables with sorting, filtering, pagination, and row actions.',
  },
  {
    icon: IconPalette,
    title: 'Theming',
    description:
      'Light and dark mode with customizable design tokens and TailwindCSS v4.',
  },
  {
    icon: IconSettings,
    title: 'Settings',
    description:
      'Profile, account, appearance, notifications, and display settings out of the box.',
  },
  {
    icon: IconLanguage,
    title: 'Internationalization',
    description:
      'Built-in i18next support with English and French translations ready to extend.',
  },
  {
    icon: IconDeviceMobile,
    title: 'Responsive',
    description:
      'Mobile-first design with collapsible sidebar and responsive layouts.',
  },
]

const testimonials = [
  {
    quote:
      'This template saved us weeks of setup. The architecture is clean and the components are production-ready.',
    author: 'Sarah Chen',
    role: 'CTO at TechStart',
  },
  {
    quote:
      'Best admin template I have used. The TypeScript strict mode and TanStack Router integration are top-notch.',
    author: 'Marcus Johnson',
    role: 'Senior Developer',
  },
  {
    quote:
      'We shipped our internal tool in half the time thanks to this template. Highly recommended.',
    author: 'Emily Rodriguez',
    role: 'Engineering Lead',
  },
]

const pricingPlans = [
  {
    name: 'Free',
    price: '$0',
    description: 'For personal projects and learning.',
    features: [
      'All template components',
      'TanStack Router setup',
      'Light & dark theme',
      'Community support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$49',
    description: 'For professional teams and startups.',
    features: [
      'Everything in Free',
      'Premium components',
      'Priority support',
      'Lifetime updates',
    ],
    cta: 'Get Pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations with custom needs.',
    features: [
      'Everything in Pro',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
    ],
    cta: 'Contact Us',
    highlighted: false,
  },
]

const faqs = [
  {
    question: 'What tech stack does this template use?',
    answer:
      'React 19, TypeScript 5.8 (strict mode), Vite 6, TanStack Router, TanStack Table, TanStack Query, ShadcnUI, TailwindCSS v4, Zustand, and React Hook Form with Zod.',
  },
  {
    question: 'Can I use this for commercial projects?',
    answer:
      'Yes! This template is MIT licensed. You can use it for personal and commercial projects without attribution.',
  },
  {
    question: 'How do I customize the theme?',
    answer:
      'The template uses CSS custom properties and TailwindCSS v4. You can customize colors, fonts, and spacing through the design tokens and Tailwind configuration.',
  },
  {
    question: 'Is the authentication real?',
    answer:
      'The template includes a complete auth UI flow (sign-in, sign-up, forgot password, OTP). The API layer is pre-configured with axios interceptors — just connect your backend.',
  },
  {
    question: 'How do I add new pages?',
    answer:
      'Create a new route file in src/routes/ and a corresponding feature component in src/features/. TanStack Router automatically discovers file-based routes.',
  },
]

export default function LandingPage() {
  return (
    <div className='flex flex-col'>
      {/* Hero */}
      <section className='container mx-auto px-4 py-20 text-center sm:px-6 sm:py-32 lg:px-8'>
        <AnimatedContainer variant='fadeSlideUp'>
          <h1 className='text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl'>
            Build Admin Dashboards
            <br />
            <span className='text-primary'>Faster Than Ever</span>
          </h1>
          <p className='text-muted-foreground mx-auto mt-6 max-w-2xl text-lg'>
            A production-ready React + TypeScript admin template with
            authentication, data tables, settings, and a modular feature-based
            architecture. Start building in minutes, not weeks.
          </p>
          <div className='mt-10 flex items-center justify-center gap-4'>
            <Button size='lg' asChild>
              <Link to='/sign-up'>Get Started</Link>
            </Button>
            <Button size='lg' variant='outline' asChild>
              <Link to='/sign-in'>Sign In</Link>
            </Button>
          </div>
        </AnimatedContainer>
      </section>

      {/* Features */}
      <section id='features' className='bg-muted/50 py-20 sm:py-24'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <AnimatedContainer variant='fadeSlideUp' className='text-center'>
            <h2 className='text-3xl font-bold tracking-tight sm:text-4xl'>
              Everything You Need
            </h2>
            <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg'>
              Built with modern tools and best practices so you can focus on your
              product, not boilerplate.
            </p>
          </AnimatedContainer>
          <StaggerContainer className='mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {features.map((feature) => (
              <StaggerItem key={feature.title}>
                <Card className='h-full'>
                  <CardHeader>
                    <feature.icon className='text-primary mb-2 h-8 w-8' />
                    <CardTitle className='text-lg'>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className='text-sm'>
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Testimonials */}
      <section id='testimonials' className='py-20 sm:py-24'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <AnimatedContainer variant='fadeSlideUp' className='text-center'>
            <h2 className='text-3xl font-bold tracking-tight sm:text-4xl'>
              Loved by Developers
            </h2>
            <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg'>
              See what others are saying about this template.
            </p>
          </AnimatedContainer>
          <StaggerContainer className='mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {testimonials.map((testimonial) => (
              <StaggerItem key={testimonial.author}>
                <Card className='h-full'>
                  <CardContent className='pt-6'>
                    <p className='text-muted-foreground text-sm italic'>
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div className='mt-4'>
                      <p className='text-sm font-medium'>
                        {testimonial.author}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {testimonial.role}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Pricing */}
      <section id='pricing' className='bg-muted/50 py-20 sm:py-24'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <AnimatedContainer variant='fadeSlideUp' className='text-center'>
            <h2 className='text-3xl font-bold tracking-tight sm:text-4xl'>
              Simple Pricing
            </h2>
            <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg'>
              Choose the plan that works for you.
            </p>
          </AnimatedContainer>
          <StaggerContainer className='mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {pricingPlans.map((plan) => (
              <StaggerItem key={plan.name}>
                <Card
                  className={`h-full ${plan.highlighted ? 'border-primary shadow-lg' : ''}`}
                >
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <div className='mt-2'>
                      <span className='text-3xl font-bold'>{plan.price}</span>
                      {plan.price !== 'Custom' && (
                        <span className='text-muted-foreground text-sm'>
                          /one-time
                        </span>
                      )}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className='space-y-2'>
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className='text-muted-foreground flex items-center gap-2 text-sm'
                        >
                          <svg
                            className='text-primary h-4 w-4 shrink-0'
                            fill='none'
                            viewBox='0 0 24 24'
                            stroke='currentColor'
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              d='M5 13l4 4L19 7'
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className='mt-6 w-full'
                      variant={plan.highlighted ? 'default' : 'outline'}
                      asChild
                    >
                      <Link to='/sign-up'>{plan.cta}</Link>
                    </Button>
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
              Frequently Asked Questions
            </h2>
            <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg'>
              Got questions? We have answers.
            </p>
          </AnimatedContainer>
          <AnimatedContainer
            variant='fadeSlideUp'
            delay={0.2}
            className='mx-auto mt-12 max-w-2xl'
          >
            <Accordion className='w-full'>
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className='text-left text-sm font-medium'>
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className='text-muted-foreground text-sm'>
                    {faq.answer}
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
              Ready to Get Started?
            </h2>
            <p className='text-muted-foreground mx-auto mt-4 max-w-xl text-lg'>
              Stop wasting time on boilerplate. Start building your admin
              dashboard today.
            </p>
            <div className='mt-8 flex items-center justify-center gap-4'>
              <Button size='lg' asChild>
                <Link to='/sign-up'>Create Account</Link>
              </Button>
              <Button size='lg' variant='outline' asChild>
                <Link to='/sign-in'>Sign In</Link>
              </Button>
            </div>
          </AnimatedContainer>
        </div>
      </section>
    </div>
  )
}
