import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  cacheDir: '.vitest-cache',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
