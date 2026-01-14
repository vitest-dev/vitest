import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
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
