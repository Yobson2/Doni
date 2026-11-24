import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { readFileSync } from 'fs'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(
  readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')
) as { version: string }

/** Brand colours (docs/brand/logo.md): ivory page, indigo symbol. */
const IVORY = '#F7F5F0'

/**
 * API reads kept by the service worker for offline use (ADR 0010):
 * portfolio, prices and catalogue, watchlist. Never the session endpoints
 * (`/api/auth/*`) and never anything but GET.
 */
const OFFLINE_READS =
  /^\/api\/(portfolios|securities|sectors|watchlist|users\/me)(\/|$)/

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Busts the offline query cache when a new version ships.
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    VitePWA({
      // A new version waits until the user accepts it (a toast with a reload
      // button, see src/lib/offline/register-sw.ts), so a form being filled
      // in is never reloaded away.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Doni',
        short_name: 'Doni',
        description:
          'Suivez vos titres de la BRVM et votre portefeuille, petit à petit.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: IVORY,
        theme_color: IVORY,
        categories: ['finance'],
        icons: [
          {
            src: '/images/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/images/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/images/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/images/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/images/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // The app shell and every JS/CSS chunk, guides and legal pages
        // included (their Markdown is bundled into route chunks, #20).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        globIgnores: ['images/og-image.png'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && OFFLINE_READS.test(url.pathname),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'doni-api',
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [200] },
              expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
        // Push notifications (#19) will add their handler with
        // `importScripts` here, or by switching to `injectManifest`.
      },
    }),
  ],
  build: {
    // Read by scripts/check-bundle-size.mjs (JavaScript budget, ADR 0010).
    manifest: true,
  },
  server: {
    // Same-origin API in development, so the refresh cookie (SameSite=Strict,
    // Path=/api/auth) is sent without any CORS setup.
    proxy: {
      '/api': process.env.VITE_DEV_API_PROXY ?? 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),

      // fix loading all icon chunks in dev mode
      // https://github.com/tabler/tabler-icons/issues/1233
      '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
    },
  },
})
