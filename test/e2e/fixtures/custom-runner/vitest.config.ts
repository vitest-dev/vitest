import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    runner: './test-runner.ts',
  },
})
