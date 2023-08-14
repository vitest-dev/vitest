import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimentalVmThreads: true,
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
