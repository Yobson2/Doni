// @vitest-environment jsdom
import { fakeApi, json, session, testUser } from '@/test/fake-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import { afterSignInPath, ensureSession, signIn, signOut } from './session'

const ACCESS_TOKEN = 'header.access-token-from-sign-in.signature'

/** Everything a script on the page can read without a network call. */
function scriptReadableStorage(): string {
  const dump = (storage: Storage) =>
    Array.from({ length: storage.length }, (_, i) => {
      const key = storage.key(i)!
      return `${key}=${storage.getItem(key)}`
    }).join('\n')
  return [dump(localStorage), dump(sessionStorage), document.cookie].join('\n')
}

describe('session', () => {
  beforeEach(() => {
    useAuthStore.getState().auth.reset()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps no token in JavaScript-readable storage after sign-in', async () => {
    const { requests } = fakeApi({
      'POST /api/auth/sign-in': () => session(ACCESS_TOKEN),
    })

    await signIn({ email: testUser.email, password: 'CorrectHorse9!' })

    expect(useAuthStore.getState().auth.accessToken).toBe(ACCESS_TOKEN)
    expect(scriptReadableStorage()).not.toContain(ACCESS_TOKEN)
    expect(scriptReadableStorage()).not.toMatch(/token/i)
    // The browser attaches the httpOnly refresh cookie only with credentials.
    expect(requests[0].credentials).toBe('include')
  })

  it('keeps no token in JavaScript-readable storage after a silent refresh', async () => {
    fakeApi({ 'POST /api/auth/refresh': () => session(ACCESS_TOKEN) })

    expect(await ensureSession()).toBe(true)

    expect(useAuthStore.getState().auth.accessToken).toBe(ACCESS_TOKEN)
    expect(scriptReadableStorage()).not.toContain(ACCESS_TOKEN)
  })

  it('sends the in-memory access token as a bearer token', async () => {
    const { requests } = fakeApi({
      'POST /api/auth/sign-in': () => session(ACCESS_TOKEN),
      'GET /api/users/me': () => json(200, testUser),
    })
    await signIn({ email: testUser.email, password: 'CorrectHorse9!' })

    const { data } = await api.GET('/api/users/me')

    expect(data?.email).toBe(testUser.email)
    expect(requests[1].headers.get('Authorization')).toBe(
      `Bearer ${ACCESS_TOKEN}`
    )
  })

  it('refreshes once and retries when the access token has expired', async () => {
    useAuthStore.getState().auth.setSession({
      accessToken: 'expired',
      expiresIn: 900,
      user: testUser,
    })
    const { requests } = fakeApi({
      'POST /api/auth/refresh': () => session('fresh'),
      'GET /api/users/me': (request) =>
        request.headers.get('Authorization') === 'Bearer fresh'
          ? json(200, testUser)
          : json(401),
    })

    // Two requests fail at the same time: they share one refresh, because
    // the server treats a second use of the same refresh token as theft.
    const [a, b] = await Promise.all([
      api.GET('/api/users/me'),
      api.GET('/api/users/me'),
    ])

    expect(a.data?.id).toBe(testUser.id)
    expect(b.data?.id).toBe(testUser.id)
    const refreshes = requests.filter((r) =>
      r.url.endsWith('/api/auth/refresh')
    )
    expect(refreshes).toHaveLength(1)
  })

  it('reports no session when the silent refresh is refused', async () => {
    fakeApi({ 'POST /api/auth/refresh': () => json(401) })

    expect(await ensureSession()).toBe(false)
    expect(useAuthStore.getState().auth.accessToken).toBe('')
  })

  it('forgets the access token on sign-out, even if the server is unreachable', async () => {
    useAuthStore.getState().auth.setSession({
      accessToken: ACCESS_TOKEN,
      expiresIn: 900,
      user: testUser,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('offline')))
    )

    await expect(signOut()).rejects.toThrow('offline')

    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('only redirects back to a page of this app after sign-in', () => {
    expect(afterSignInPath('/settings?tab=appearance')).toBe(
      '/settings?tab=appearance'
    )
    expect(afterSignInPath(undefined)).toBe('/dashboard')
    expect(afterSignInPath('https://elsewhere.example')).toBe('/dashboard')
    expect(afterSignInPath('//elsewhere.example')).toBe('/dashboard')
  })
})
