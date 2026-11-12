import path from 'path'
import { defineConfig } from 'vitest/config'

// Unit tests run without the app's Vite plugins (router codegen, Tailwind).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
