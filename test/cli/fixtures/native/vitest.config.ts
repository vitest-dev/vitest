import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./setup.ts'],
    globalSetup: './globalSetup.ts',
    experimental: {
      nativeImport: true,
    },
  },
})
