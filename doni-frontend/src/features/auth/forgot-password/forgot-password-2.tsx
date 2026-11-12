import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AuthSplitLayout } from '../auth-split-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'

const linkClass = 'text-primary font-medium underline-offset-4 hover:underline'

export default function ForgotPassword2() {
  const { t } = useTranslation()

  return (
    <AuthSplitLayout
      title={t('auth.forgotPassword.title')}
      subtitle={t('auth.forgotPassword.description')}
      footer={
        <>
          {t('auth.signIn.noAccount')}{' '}
          <Link to='/sign-up' className={linkClass}>
            {t('auth.signIn.createAccount')}
          </Link>
          {' · '}
          <Link to='/sign-in' className={linkClass}>
            {t('auth.forgotPassword.backToSignIn')}
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthSplitLayout>
  )
}
