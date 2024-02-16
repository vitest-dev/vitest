import { defineConfig } from 'vitest/config'

// cf.
// https://stackblitz.com/edit/vitest-dev-vitest-8wf26p?file=test%2Fssr.test.ts

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
  // use dummy ssrLoadModule to trigger ssr.optimizeDeps.
  // this will be unnecessary from Vite 5.1
  // cf. https://github.com/vitejs/vite/pull/15561
  plugins: [
    {
      name: 'force-ssr-optimize-deps',
      configureServer(server) {
        return async () => {
          await server.ssrLoadModule('/package.json')
        }
      },
    },
  ],
})
