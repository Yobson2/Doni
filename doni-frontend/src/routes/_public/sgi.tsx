import { createFileRoute } from '@tanstack/react-router'
import SgiDirectory from '@/features/content/sgi-directory'

export const Route = createFileRoute('/_public/sgi')({
  component: SgiDirectory,
})
