import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AuthSplitLayout } from '../auth-split-layout'
import { SignUpForm } from './components/sign-up-form'

export default function SignUp2() {
  const { t } = useTranslation()

  return (
    <AuthSplitLayout
      title={t('auth.signUp.title')}
      subtitle={t('auth.signUp.subtitle')}
      footer={
        <>
          {t('auth.signUp.haveAccount')}{' '}
          <Link
            to='/sign-in'
            className='text-primary font-medium underline-offset-4 hover:underline'
          >
            {t('auth.signUp.signIn')}
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthSplitLayout>
  )
}
