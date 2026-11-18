import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      traceTimeline: true,
    },
  },
})
