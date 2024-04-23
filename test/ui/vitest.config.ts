import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    dir: './fixtures',
    environment: 'happy-dom',
    coverage: {
      reportOnFailure: true,
    },
  },
})
