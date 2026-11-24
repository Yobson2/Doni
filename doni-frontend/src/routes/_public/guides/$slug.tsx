import { createFileRoute } from '@tanstack/react-router'
import GuidePage from '@/features/content/guide-page'

export const Route = createFileRoute('/_public/guides/$slug')({
  component: RouteComponent,
})

function RouteComponent() {
  const { slug } = Route.useParams()
  return <GuidePage slug={slug} />
}
