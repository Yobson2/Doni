import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { CatalogueAdmin } from '@/features/securities/admin/catalogue-admin'

export const Route = createFileRoute('/_authenticated/admin/catalogue')({
  // The session is already established by the parent route. The API enforces
  // the admin role too; this only keeps members away from a page they cannot use.
  beforeLoad: () => {
    if (useAuthStore.getState().auth.user?.role !== 'ADMIN') {
      throw redirect({ to: '/403' })
    }
  },
  component: CatalogueAdmin,
})
