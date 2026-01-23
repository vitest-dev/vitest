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
        assert(isRunnableDevEnvironment(ssr))
        const mod = await ssr.runner.import<{ vite: typeof import("vite") }>('./test-runner.js')
        assert(mod.vite.createServer === createServer)
        ;(globalThis as any).__testSsrRunner = mod.vite.version
      },
    },
  ],
})
