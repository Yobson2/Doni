import { useTranslation } from 'react-i18next'
import ContentSection from '../components/content-section'
import { DeleteAccount } from './delete-account'
import { ExportData } from './export-data'

export default function SettingsAccount() {
  const { t } = useTranslation()

  return (
    <ContentSection
      title={t('settings.account.title')}
      desc={t('settings.account.description')}
    >
      <div className='space-y-10'>
        <ExportData />
        <DeleteAccount />
      </div>
    </ContentSection>
  )
}
