import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./setup-attest-snapshot.ts'],
    globalSetup: ['./setup-attest-analyze.ts'],
  },
})
