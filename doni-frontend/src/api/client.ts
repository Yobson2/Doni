import createClient from 'openapi-fetch'
import { useAuthStore } from '@/stores/authStore'
import type { paths } from './schema'

/**
 * API origin. Defaults to the app's own origin: in development Vite proxies
 * `/api` to the backend, so the refresh cookie stays same-origin.
 */
const baseUrl = import.meta.env.VITE_API_URL || globalThis.location?.origin

/** Paths that authenticate with the refresh cookie, not a bearer token. */
const SESSION_PATHS = ['/api/auth/']

/** A non-2xx API response. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
  }
}

/** Returns the data of an openapi-fetch result, or throws an ApiError. */
export function unwrap<T>(result: {
  data?: T
  error?: unknown
  response: Response
}): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(result.response.status, result.error)
  }
  return result.data as T
}

// Look fetch up on every call so tests can stub it.
const send = (request: Request) => globalThis.fetch(request)

/**
 * Client for the session endpoints (sign-up, sign-in, refresh, sign-out).
 * Sends cookies, so the browser attaches the httpOnly refresh cookie.
 */
export const sessionApi = createClient<paths>({
  baseUrl,
  credentials: 'include',
  fetch: send,
})

let refreshing: Promise<boolean> | null = null

/**
 * Silent refresh: exchanges the refresh cookie for a new access token.
 * Single-flight: concurrent callers share one request, because the server
 * rotates the token on each refresh and treats reuse as theft.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= sessionApi
    .POST('/api/auth/refresh')
    .then(({ data }) => {
      if (data) {
        useAuthStore.getState().auth.setSession(data)
        return true
      }
      useAuthStore.getState().auth.reset()
      return false
    })
    .catch(() => {
      useAuthStore.getState().auth.reset()
      return false
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

const withBearer = (request: Request): Request => {
  const token = useAuthStore.getState().auth.accessToken
  const next = new Request(request)
  if (token) next.headers.set('Authorization', `Bearer ${token}`)
  return next
}

/**
 * Adds the access token; on a 401 refreshes the session once and retries,
 * so an expired access token is replaced without the user noticing.
 */
async function authFetch(request: Request): Promise<Response> {
  const retry = request.clone()
  const response = await send(withBearer(request))
  const isSessionCall = SESSION_PATHS.some((path) =>
    new URL(request.url).pathname.startsWith(path)
  )
  if (response.status !== 401 || isSessionCall) return response

  if (!(await refreshSession())) return response
  return send(withBearer(retry))
}

/** Client for every other endpoint, authenticated with the access token. */
export const api = createClient<paths>({ baseUrl, fetch: authFetch })
