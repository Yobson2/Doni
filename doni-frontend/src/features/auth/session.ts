import { sessionApi, tryRefreshSession, unwrap } from '@/api/client'
import type { components } from '@/api/schema'
import { useAuthStore } from '@/stores/authStore'
import {
  clearUserData,
  resumeOfflineSession,
} from '@/lib/offline/query-persistence'

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

/**
 * Ends the session on the server, forgets the access token and deletes the
 * user's data kept on this device for offline use (ADR 0010), so nothing
 * survives on a shared device.
 */
export async function signOut(): Promise<void> {
  try {
    await sessionApi.POST('/api/auth/sign-out')
  } finally {
    useAuthStore.getState().auth.reset()
    await clearUserData()
  }
}

/**
 * True when there is a usable session: an access token in memory, or one
 * obtained by silent refresh (after a reload, memory starts empty). When the
 * server cannot be reached (offline), the last synced data of the user
 * signed in on this device is shown read-only instead (ADR 0010).
 */
export async function ensureSession(): Promise<boolean> {
  if (useAuthStore.getState().auth.accessToken) return true
  const outcome = await tryRefreshSession()
  if (outcome === 'refreshed') return true
  return outcome === 'unreachable' && resumeOfflineSession()
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
