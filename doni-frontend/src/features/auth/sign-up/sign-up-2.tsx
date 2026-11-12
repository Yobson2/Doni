import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/logo'
import { AnimatedContainer } from '@/components/motion/animated-container'
import { SignUpForm } from './components/sign-up-form'

export default function SignUp2() {
  return (
    <AnimatedContainer variant='scaleIn' className='relative container grid h-svh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='bg-muted relative hidden h-full flex-col p-10 text-white lg:flex dark:border-r'>
        <div className='absolute inset-0 bg-foreground' />
        <Link to='/' className='relative z-20 flex items-center text-lg font-medium'>
          <Logo className='mr-2 h-6 w-6' />
          React Admin
        </Link>

        <div className='relative z-20 m-auto flex flex-col items-center gap-4'>
          <Logo className='h-16 w-16' />
          <span className='text-3xl font-bold tracking-tight'>React Admin</span>
        </div>

        <div className='relative z-20 mt-auto'>
          <blockquote className='space-y-2'>
            <p className='text-lg'>
              &ldquo;This template has saved me countless hours of work and
              helped me deliver stunning designs to my clients faster than ever
              before.&rdquo;
            </p>
          </blockquote>
        </div>
      </div>
      <div className='lg:p-8'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 sm:w-[350px]'>
          <Link to='/' className='mb-4 flex items-center gap-2 lg:hidden'>
            <Logo className='h-6 w-6' />
            <span className='text-lg font-semibold'>React Admin</span>
          </Link>
          <div className='flex flex-col space-y-2 text-left'>
            <h1 className='text-2xl font-semibold tracking-tight'>
              Create an account
            </h1>
            <p className='text-muted-foreground text-sm'>
              Enter your email and password to create an account.
              <br />
              Already have an account?{' '}
              <Link
                to='/sign-in'
                className='hover:text-primary underline underline-offset-4'
              >
                Sign In
              </Link>
            </p>
          </div>
          <SignUpForm />
          <p className='text-muted-foreground px-8 text-center text-sm'>
            By creating an account, you agree to our{' '}
            <a
              href='/terms'
              className='hover:text-primary underline underline-offset-4'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy'
              className='hover:text-primary underline underline-offset-4'
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </AnimatedContainer>
  )
}
