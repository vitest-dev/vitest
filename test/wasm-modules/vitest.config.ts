import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    poolOptions: {
      threads: {
        execArgv: ['--experimental-wasm-modules'],
      },
      forks: {
        execArgv: ['--experimental-wasm-modules'],
      },
    },
    server: {
      deps: {
        external: [/\.wasm$/],
      },
    },
  },
})
