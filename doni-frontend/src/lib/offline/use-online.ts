import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const getSnapshot = () => navigator.onLine
// Rendering without a browser (tests in node): assume a connection.
const getServerSnapshot = () => true

/**
 * Whether the browser has a network connection. The single source of truth
 * for offline mode (ADR 0010): the offline banner, the "synced on" labels and
 * every write action read it, never `navigator.onLine` directly.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
