import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./setup-attest-analyze.ts'],
    setupFiles: ['./setup-attest-snapshot.ts'],
  },
})
