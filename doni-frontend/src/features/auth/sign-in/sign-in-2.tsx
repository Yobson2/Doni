import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { AuthSplitLayout } from '../auth-split-layout'
import { UserAuthForm } from './components/user-auth-form'

export default function SignIn2() {
  const { t } = useTranslation()

  return (
    <AuthSplitLayout
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      footer={
        <>
          {t('auth.signIn.noAccount')}{' '}
          <Link
            to='/sign-up'
            className='text-primary font-medium underline-offset-4 hover:underline'
          >
            {t('auth.signIn.createAccount')}
          </Link>
        </>
      }
    >
      <UserAuthForm />
    </AuthSplitLayout>
  )
}
