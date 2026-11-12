import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Logo, Wordmark } from '@/components/logo'
import { LanguageSwitch } from '@/components/language-switch'
import { AnimatedContainer } from '@/components/motion/animated-container'

interface Props {
  title: string
  description: React.ReactNode
  children: React.ReactNode
}

/** Two-column layout shared by the sign-in, sign-up and forgot-password screens. */
export function AuthSplitLayout({ title, description, children }: Props) {
  const { t } = useTranslation()

  return (
    <AnimatedContainer
      variant='scaleIn'
      className='relative container grid h-svh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0'
    >
      <LanguageSwitch className='absolute top-4 right-4 z-30' />
      <div className='bg-primary text-primary-foreground dark:bg-secondary dark:text-foreground relative hidden h-full flex-col p-10 lg:flex dark:border-r'>
        <div className='bg-primary dark:bg-secondary absolute inset-0' />
        <Link
          to='/'
          className='relative z-20 flex items-center text-lg font-medium'
        >
          <Wordmark className='h-7 w-auto' />
        </Link>

        <div className='relative z-20 m-auto flex flex-col items-center gap-4'>
          <Logo className='h-24 w-24' />
          <span className='text-lg font-medium opacity-90'>
            {t('app.tagline')}
          </span>
        </div>

        <p className='relative z-20 mt-auto text-sm opacity-80'>
          {t('app.disclaimer')}
        </p>
      </div>
      <div className='lg:p-8'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 sm:w-[350px]'>
          <Link to='/' className='mb-4 flex items-center gap-2 lg:hidden'>
            <Wordmark className='text-primary h-7 w-auto' />
          </Link>
          <div className='flex flex-col space-y-2 text-left'>
            <h1 className='text-2xl font-semibold tracking-tight'>{title}</h1>
            <p className='text-muted-foreground text-sm'>{description}</p>
          </div>
          {children}
        </div>
      </div>
    </AnimatedContainer>
  )
}
