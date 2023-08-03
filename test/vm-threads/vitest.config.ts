import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimentalVmThreads: true,
    server: {
      deps: {
        external: [/src\/external/],
      },
    },
  },
})
