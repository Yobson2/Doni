import { createFileRoute } from '@tanstack/react-router'
import GuidesList from '@/features/content/guides-list'

export const Route = createFileRoute('/_public/guides/')({
  component: GuidesList,
})
