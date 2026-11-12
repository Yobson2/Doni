import { createFileRoute } from '@tanstack/react-router'
import { SecuritiesList } from '@/features/securities/securities-list'

export const Route = createFileRoute('/_authenticated/securities/')({
  component: SecuritiesList,
})
