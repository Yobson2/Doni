// @vitest-environment jsdom
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { fakeApi, json, session } from '@/test/fake-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/authStore'

/** Navigates a fresh app (as after a reload) to `path` and settles. */
async function open(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return router.state.location
}

describe('protected routes', () => {
  beforeEach(() => {
    useAuthStore.getState().auth.reset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects unauthenticated navigation to sign-in, remembering the page', async () => {
    const { requests } = fakeApi({
      'POST /api/auth/refresh': () => json(401),
    })

    const location = await open('/settings')

    expect(location.pathname).toBe('/sign-in')
    expect(location.search).toEqual({ redirect: '/settings' })
    // It tried a silent refresh first.
    expect(requests.map((r) => new URL(r.url).pathname)).toEqual([
      '/api/auth/refresh',
    ])
  })

  it('opens the page when a silent refresh restores the session', async () => {
    fakeApi({ 'POST /api/auth/refresh': () => session('fresh') })

    const location = await open('/dashboard')

    expect(location.pathname).toBe('/dashboard')
    expect(useAuthStore.getState().auth.accessToken).toBe('fresh')
  })

  it('leaves public pages alone', async () => {
    const { requests } = fakeApi({})

    const location = await open('/sign-in')

    expect(location.pathname).toBe('/sign-in')
    expect(requests).toHaveLength(0)
  })
})
