import type { QueryClient } from '@tanstack/react-query'
import type { components } from '@/api/schema'
import { useAuthStore } from '@/stores/authStore'

type User = components['schemas']['UserResponseDto']

/**
 * How long a saved copy of the data stays usable offline. Queries are kept in
 * memory as long, or they would be dropped from the saved copy first.
 */
export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000

/** The signed-in user, kept with the cached data so it can be shown offline. */
const ME_KEY = ['me'] as const

/** Runtime cache of API reads in the service worker (see vite.config.ts). */
const API_CACHE_NAME = 'doni-api'

let client: QueryClient | null = null
let restored: Promise<void> = Promise.resolve()
let removeSaved: Promise<() => Promise<void>> | null = null

/** The IndexedDB persister, in its own chunk (not in the first-load JS). */
async function loadPersister() {
  const { persist, removePersisted } = await import('./persister')
  return { restore: persist, remove: removePersisted }
}

/**
 * Saves the query cache to IndexedDB and restores it on the next visit, so
 * the last synced portfolio and prices show offline (ADR 0010). The saving
 * code loads after the first render.
 */
export function startQueryPersistence(queryClient: QueryClient): void {
  client = queryClient
  const loaded = loadPersister()
  removeSaved = loaded.then(({ remove }) => remove)
  restored = loaded
    .then(({ restore }) => restore(queryClient))
    .catch(() => undefined) // No IndexedDB (private mode): online only.

  // Remember who the data belongs to; a different user starts afresh.
  useAuthStore.subscribe(({ auth: { user } }) => {
    if (!user) return
    const cached = queryClient.getQueryData<User>(ME_KEY)
    if (cached && cached.id !== user.id) void clearUserData()
    queryClient.setQueryData(ME_KEY, user)
  })
}

/**
 * Offline, after a reload: there is no access token and no way to get one,
 * but the user's last synced data may be on this device. Shows it, read-only,
 * if it is there; the session is checked again once the connection is back.
 */
export async function resumeOfflineSession(): Promise<boolean> {
  await restored // The saved cache, restored (or found missing).
  const user = client?.getQueryData<User>(ME_KEY)
  if (!user) return false
  useAuthStore.getState().auth.setUser(user)
  return true
}

/**
 * Forgets every piece of user data on this device: the in-memory and saved
 * query caches and the service worker's API cache. On sign-out, so nothing
 * survives on a shared device.
 */
export async function clearUserData(): Promise<void> {
  client?.clear()
  await Promise.all([
    removeSaved?.then((remove) => remove()).catch(() => undefined),
    globalThis.caches?.delete(API_CACHE_NAME).catch(() => false),
  ])
}
