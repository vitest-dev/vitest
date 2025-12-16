import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // the hardest to support
    // TODO: ideally, this should run in a matrix
    isolate: false,
    maxWorkers: 1,
    setupFiles: [
      './jsSetup.js',
      './tsSetup.ts',
    ],
    includeSource: ['./src/in-source/*'],
    experimental: {
      viteModuleRunner: false,
      // nodeLoader: false,
    },
  },
})
