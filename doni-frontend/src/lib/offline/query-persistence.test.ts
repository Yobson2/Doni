// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { fakeApi, json, session, testUser } from '@/test/fake-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// IndexedDB is not in jsdom: the saved copy is stood in for by a spy.
const removePersisted = vi.fn(async () => {})
vi.mock('./persister', () => ({
  persist: async () => {},
  removePersisted: () => removePersisted(),
}))

/** A fresh app (as after a reload): modules, query client, persistence. */
async function load() {
  vi.resetModules()
  const persistence = await import('./query-persistence')
  const sessionModule = await import('@/features/auth/session')
  const { useAuthStore } = await import('@/stores/authStore')
  const queryClient = new QueryClient()
  persistence.startQueryPersistence(queryClient)
  return { ...persistence, ...sessionModule, useAuthStore, queryClient }
}

const offline = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
  )

describe('offline session and cached data', () => {
  let cachesDelete: ReturnType<typeof vi.fn>

  beforeEach(() => {
    removePersisted.mockClear()
    cachesDelete = vi.fn(async () => true)
    vi.stubGlobal('caches', { delete: cachesDelete })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('offline after a reload, shows the last signed-in user’s data read-only', async () => {
    const app = await load()
    fakeApi({ 'POST /api/auth/refresh': () => session('token') })
    await app.ensureSession()
    app.queryClient.setQueryData(['portfolios'], [{ id: 'p1' }])
    // Reload: the access token was in memory only.
    app.useAuthStore.getState().auth.reset()
    offline()

    expect(await app.ensureSession()).toBe(true)

    const { auth } = app.useAuthStore.getState()
    expect(auth.user?.email).toBe(testUser.email)
    expect(auth.accessToken).toBe('')
    expect(app.queryClient.getQueryData(['portfolios'])).toEqual([{ id: 'p1' }])
  })

  it('offline with no synced data, there is no session', async () => {
    const app = await load()
    offline()
    expect(await app.ensureSession()).toBe(false)
  })

  it('a refused session is not resumed from cached data', async () => {
    const app = await load()
    fakeApi({ 'POST /api/auth/refresh': () => session('token') })
    await app.ensureSession()
    app.useAuthStore.getState().auth.reset()
    fakeApi({ 'POST /api/auth/refresh': () => json(401) })

    expect(await app.ensureSession()).toBe(false)
  })

  it('sign-out deletes the cached data: memory, IndexedDB and the service worker cache', async () => {
    const app = await load()
    fakeApi({
      'POST /api/auth/refresh': () => session('token'),
      'POST /api/auth/sign-out': () => new Response(null, { status: 204 }),
    })
    await app.ensureSession()
    app.queryClient.setQueryData(['portfolios'], [{ id: 'p1' }])

    await app.signOut()

    expect(app.queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(removePersisted).toHaveBeenCalled()
    expect(cachesDelete).toHaveBeenCalledWith('doni-api')
    offline()
    expect(await app.ensureSession()).toBe(false)
  })

  it('sign-out offline still deletes the cached data', async () => {
    const app = await load()
    fakeApi({ 'POST /api/auth/refresh': () => session('token') })
    await app.ensureSession()
    offline()

    await expect(app.signOut()).rejects.toThrow()

    expect(app.queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(removePersisted).toHaveBeenCalled()
  })

  it('another user signing in on the device starts from an empty cache', async () => {
    const app = await load()
    fakeApi({ 'POST /api/auth/refresh': () => session('token') })
    await app.ensureSession()
    app.queryClient.setQueryData(['portfolios'], [{ id: 'p1' }])

    app.useAuthStore.getState().auth.setSession({
      accessToken: 'other',
      expiresIn: 900,
      user: { ...testUser, id: 'someone-else', email: 'b@example.com' },
    } as never)

    expect(app.queryClient.getQueryData(['portfolios'])).toBeUndefined()
    await vi.waitFor(() => expect(removePersisted).toHaveBeenCalled())
  })
})
