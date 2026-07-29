import { defineConfig } from 'vitest/config'

export default defineConfig({
  ssr: {
    noExternal: ["test-dep-simple"],
    optimizeDeps: {
      include: ["@test/test-dep-url"],
    },
  },
  test: {
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
        },
      },
    },
  },
})
