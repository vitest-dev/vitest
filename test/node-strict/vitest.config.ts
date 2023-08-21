import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        external: [/src\/external/],
      },
    },
    environment: 'node',
    environmentOptions: {
      node: {
        strict: true,
      },
    },
    experimentalVmThreads: true,
  },
})
