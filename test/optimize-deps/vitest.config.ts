import { defineConfig } from 'vitest/config'

export default defineConfig({
  optimizeDeps: {
    include: ['@vitest/test-dep-url'],
  },
  ssr: {
    optimizeDeps: {
      include: ['@vitest/test-dep-url'],
    },
  },
  test: {
    chaiConfig: {
      truncateThreshold: 1000,
    },
    deps: {
      optimizer: {
        web: {
          enabled: true,
        },
        ssr: {
          enabled: true,
        },
      },
    },
  },
})
