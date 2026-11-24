import { createFileRoute } from '@tanstack/react-router'
import LegalPage from '@/features/content/legal-page'

export const Route = createFileRoute('/_public/privacy')({
  component: () => <LegalPage slug='privacy' />,
})
