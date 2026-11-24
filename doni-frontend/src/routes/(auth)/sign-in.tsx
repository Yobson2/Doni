import { createFileRoute } from '@tanstack/react-router'
import SignIn2 from '@/features/auth/sign-in/sign-in-2'

export const Route = createFileRoute('/(auth)/sign-in')({
  // A plain check rather than a schema library: route definitions are in the
  // first-load bundle (ADR 0010 JavaScript budget).
  validateSearch: (
    search: Record<string, unknown>
  ): {
    /** The protected page the user was sent away from. */
    redirect?: string
  } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  component: SignIn2,
})
