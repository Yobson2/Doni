import i18n from '@/i18n'
import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'

/**
 * Registers the service worker (app shell and chunks precached, API reads
 * network-first; see vite.config.ts).
 *
 * Update strategy: "prompt". When a new version has been downloaded, a toast
 * offers to reload into it; until then the current version keeps running,
 * so nothing the user is typing is lost. Unaccepted, the new version takes
 * over once every Doni tab is closed.
 */
export function registerServiceWorker(): void {
  const update = registerSW({
    onNeedRefresh() {
      toast(i18n.t('offline.update.title'), {
        description: i18n.t('offline.update.description'),
        duration: Infinity,
        action: {
          label: i18n.t('offline.update.reload'),
          onClick: () => void update(true),
        },
      })
    },
  })
}
