import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import {
  PERSIST_MAX_AGE,
  clearUserData,
  startQueryPersistence,
} from '@/lib/offline/query-persistence'
import { handleServerError } from '@/utils/handle-server-error'
import { FontProvider } from './context/font-context'
import { ThemeProvider } from './context/theme-context'
import i18n from './i18n'
import './index.css'
// Generated Routes
import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) console.log({ failureCount, error })

        if (failureCount >= 0 && import.meta.env.DEV) return false
        if (failureCount > 3 && import.meta.env.PROD) return false

        return !(error instanceof ApiError && [401, 403].includes(error.status))
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000, // 10s
      // Kept as long as the offline copy, or unused queries would be dropped
      // from it before then (ADR 0010).
      gcTime: PERSIST_MAX_AGE,
    },
    mutations: {
      onError: (error) => {
        handleServerError(error)
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError) {
        // A 401 here means the silent refresh failed too: the session ended.
        if (error.status === 401) {
          toast.error(i18n.t('errors.toast.sessionExpired'))
          useAuthStore.getState().auth.reset()
          // The session is over: its data must not stay readable offline.
          void clearUserData()
          const redirect = `${router.history.location.href}`
          router.navigate({ to: '/sign-in', search: { redirect } })
        }
        if (error.status === 500) {
          toast.error(i18n.t('errors.toast.serverError'))
          router.navigate({ to: '/500' })
        }
      }
    },
  }),
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Offline mode (ADR 0010): last synced data from IndexedDB, and the service
// worker (production only; it would cache the dev server's modules).
// Start from the browser's connection state: after a reload offline no
// `offline` event fires, so queries would fail and retry instead of waiting.
onlineManager.setOnline(navigator.onLine)
startQueryPersistence(queryClient)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('@/lib/offline/register-sw').then((m) =>
    m.registerServiceWorker()
  )
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme='light' storageKey='vite-ui-theme'>
          <FontProvider>
            <RouterProvider router={router} />
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
