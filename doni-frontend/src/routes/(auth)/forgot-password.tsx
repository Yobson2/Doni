import { createFileRoute } from '@tanstack/react-router'
import ForgotPassword2 from '@/features/auth/forgot-password/forgot-password-2'

export const Route = createFileRoute('/(auth)/forgot-password')({
  component: ForgotPassword2,
})
