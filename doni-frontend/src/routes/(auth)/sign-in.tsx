import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import SignIn2 from '@/features/auth/sign-in/sign-in-2'

const searchSchema = z.object({
  /** The protected page the user was sent away from. */
  redirect: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  validateSearch: (search: Record<string, unknown>) =>
    searchSchema.parse(search),
  component: SignIn2,
})
