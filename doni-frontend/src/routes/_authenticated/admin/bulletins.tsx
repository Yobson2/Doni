import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { BulletinsAdmin } from '@/features/bulletins/bulletins-admin'

export const Route = createFileRoute('/_authenticated/admin/bulletins')({
  // The API enforces the admin role too; this keeps members off the page.
  beforeLoad: () => {
    if (useAuthStore.getState().auth.user?.role !== 'ADMIN') {
      throw redirect({ to: '/403' })
    }
  },
  component: BulletinsAdmin,
})
