import path from 'path'
import { defineConfig } from 'vitest/config'

// Unit tests run without the app's Vite plugins (router codegen, Tailwind).
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('test') },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
  },
})
