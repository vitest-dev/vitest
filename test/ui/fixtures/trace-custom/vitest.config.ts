import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './global-setup.ts',
    runner: './trace/runner.ts',
    ui: true,
  },
})
