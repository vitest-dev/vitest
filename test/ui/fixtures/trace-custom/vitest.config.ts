import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    runner: './trace/runner.ts',
    ui: true,
  },
})
