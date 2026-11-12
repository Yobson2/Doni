import { refreshSession, sessionApi, unwrap } from '@/api/client'
import type { components } from '@/api/schema'
import { useAuthStore } from '@/stores/authStore'

type SignInBody = components['schemas']['SignInDto']
type SignUpBody = components['schemas']['SignUpDto']

/** Signs in; the server sets the refresh cookie, the access token stays here. */
export async function signIn(body: SignInBody): Promise<void> {
  const session = unwrap(await sessionApi.POST('/api/auth/sign-in', { body }))
  useAuthStore.getState().auth.setSession(session)
}

/** Creates the account and signs it in. */
export async function signUp(body: SignUpBody): Promise<void> {
  const session = unwrap(await sessionApi.POST('/api/auth/sign-up', { body }))
  useAuthStore.getState().auth.setSession(session)
}

/** Ends the session on the server and forgets the access token. */
export async function signOut(): Promise<void> {
  try {
    await sessionApi.POST('/api/auth/sign-out')
  } finally {
    useAuthStore.getState().auth.reset()
  }
}

/**
 * True when there is a usable session: an access token in memory, or one
 * obtained by silent refresh (after a reload, memory starts empty).
 */
export async function ensureSession(): Promise<boolean> {
  if (useAuthStore.getState().auth.accessToken) return true
  return refreshSession()
}

/**
 * Where to go after signing in: the page the user was sent away from, if it
 * is a path in this app; the dashboard otherwise.
 */
export function afterSignInPath(redirect: string | undefined): string {
  return redirect && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/dashboard'
}
