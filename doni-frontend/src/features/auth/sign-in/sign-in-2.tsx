import { useTranslation } from 'react-i18next'
import { AuthSplitLayout } from '../auth-split-layout'
import { LegalNotice } from '../legal-notice'
import { UserAuthForm } from './components/user-auth-form'

export default function SignIn2() {
  const { t } = useTranslation()

  return (
    <AuthSplitLayout
      title={t('auth.signIn.title')}
      description={t('auth.signIn.description')}
    >
      <UserAuthForm />
      <LegalNotice i18nKey='auth.signIn.legal' />
    </AuthSplitLayout>
  )
}
