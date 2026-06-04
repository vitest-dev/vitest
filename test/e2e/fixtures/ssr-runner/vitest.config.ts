import assert from 'node:assert'
import { isRunnableDevEnvironment, createServer } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'test-ssr-runner',
      // test ssr runner.import() with correct external semantics in configureServer hook
      // vite should be externalized and reference-equal to the directly imported one
      async configureServer(server) {
        const ssr = server.environments.ssr
        if (isRunnableDevEnvironment(ssr)) {
          const m = await ssr.runner.import<{ default: typeof import("vite") }>('./test-runner.js')
          assert(m.default.createServer === createServer)
          ;(globalThis as any).__testSsrRunner = m.default.version
        }
      },
    },
  ],
})
