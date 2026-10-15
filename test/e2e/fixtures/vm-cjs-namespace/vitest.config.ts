import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // pool is provided by the running test (vmThreads or vmForks)
    server: {
      deps: {
        external: [/src\/external/],
      },
    },
  },
})
