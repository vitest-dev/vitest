import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    isolate: false,
    maxWorkers: 1,
    setupFiles: [
      './jsSetup.js',
      './tsSetup.ts',
    ],
    includeSource: ['./src/in-source/*'],
    experimental: {
      viteModuleRunner: false,
    },
  },
})
