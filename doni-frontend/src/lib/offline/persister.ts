import type { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { del, get, set } from 'idb-keyval'
import { PERSIST_MAX_AGE } from './query-persistence'

/**
 * The query cache, saved to IndexedDB. Loaded lazily (after the first
 * render) so it adds nothing to the first-load JavaScript budget.
 */
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key).then((value) => value ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  key: 'doni-query-cache',
  throttleTime: 1000,
})

/** Restores the saved cache, then keeps saving it; resolves once restored. */
export function persist(queryClient: QueryClient): Promise<void> {
  const [, restored] = persistQueryClient({
    queryClient,
    persister,
    maxAge: PERSIST_MAX_AGE,
    // A new app version starts from an empty cache: the shape of the data
    // may have changed.
    buster: __APP_VERSION__,
    dehydrateOptions: {
      // Only successful reads are kept; writes are never queued (ADR 0010).
      shouldDehydrateMutation: () => false,
    },
  })
  return restored
}

/** Deletes the saved cache. */
export function removePersisted(): Promise<void> {
  return Promise.resolve(persister.removeClient())
}
