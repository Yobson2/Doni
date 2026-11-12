import { createFileRoute } from '@tanstack/react-router'
import { CompanyPage } from '@/features/securities/company-page'

export const Route = createFileRoute('/_authenticated/securities/$ticker')({
  component: RouteComponent,
})

function RouteComponent() {
  const { ticker } = Route.useParams()
  return <CompanyPage ticker={ticker} />
}
