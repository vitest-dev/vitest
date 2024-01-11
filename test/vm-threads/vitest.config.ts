import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'vmThreads',
    css: {
      include: [/processed/],
    },
    server: {
      deps: {
        external: [/src\/external/],
      },
    },
  },
})
