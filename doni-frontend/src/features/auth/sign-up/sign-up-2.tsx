import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AuthSplitLayout } from '../auth-split-layout'
import { LegalNotice } from '../legal-notice'
import { SignUpForm } from './components/sign-up-form'

export default function SignUp2() {
  const { t } = useTranslation()

  return (
    <AuthSplitLayout
      title={t('auth.signUp.title')}
      description={
        <>
          {t('auth.signUp.description')}
          <br />
          {t('auth.signUp.haveAccount')}{' '}
          <Link
            to='/sign-in'
            className='hover:text-primary underline underline-offset-4'
          >
            {t('auth.signIn.action')}
          </Link>
        </>
      }
    >
      <SignUpForm />
      <LegalNotice i18nKey='auth.signUp.legal' />
    </AuthSplitLayout>
  )
}
