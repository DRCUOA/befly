import { defineConfig } from 'vitest/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    reporters: ['basic'],
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  resolve: {
    alias: {
      '@shared/*': path.resolve(__dirname, '../shared/*'),
    },
  },
})
