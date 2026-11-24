import { defineConfig, devices } from '@playwright/test'

const APP_PORT = 4173
const API_PORT = 3999

/**
 * Browser tests of the built app (a service worker only runs in a production
 * build). The API is a stub (e2e/mock-api.mjs) that `vite preview` proxies
 * `/api` to, so no backend or database is needed.
 *
 *   pnpm build && pnpm test:browser
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'retain-on-failure',
    locale: 'fr-FR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      command: `node e2e/mock-api.mjs`,
      env: { MOCK_API_PORT: String(API_PORT) },
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm exec vite preview --port ${APP_PORT} --strictPort`,
      env: { VITE_DEV_API_PROXY: `http://localhost:${API_PORT}` },
      port: APP_PORT,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
