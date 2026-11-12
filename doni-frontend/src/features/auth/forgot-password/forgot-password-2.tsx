import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AuthSplitLayout } from '../auth-split-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'

const linkClass = 'hover:text-primary underline underline-offset-4'

export default function ForgotPassword2() {
  const { t } = useTranslation()

  return (
    <AuthSplitLayout
      title={t('auth.forgotPassword.title')}
      description={t('auth.forgotPassword.description')}
    >
      <ForgotPasswordForm />
      <p className='text-muted-foreground px-8 text-center text-sm'>
        {t('auth.forgotPassword.noAccount')}{' '}
        <Link to='/sign-up' className={linkClass}>
          {t('auth.signUp.action')}
        </Link>
        {' · '}
        <Link to='/sign-in' className={linkClass}>
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
      </p>
    </AuthSplitLayout>
  )
}
