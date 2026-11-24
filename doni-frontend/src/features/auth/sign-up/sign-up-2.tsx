import { Link } from '@tanstack/react-router'
import { Trans, useTranslation } from 'react-i18next'
import { AuthSplitLayout } from '../auth-split-layout'
import { SignUpForm } from './components/sign-up-form'

const legalLinkClass = 'text-foreground underline underline-offset-4'

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
      <p className='text-muted-foreground mt-6 text-xs'>
        <Trans
          i18nKey='auth.signUp.legalConsent'
          components={{
            disclaimer: <Link to='/disclaimer' className={legalLinkClass} />,
            privacy: <Link to='/privacy' className={legalLinkClass} />,
          }}
        />
      </p>
    </AuthSplitLayout>
  )
}
