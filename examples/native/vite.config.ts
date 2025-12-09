import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    includeSource: ['./src/in-source/*'],
    experimental: {
      viteModuleRunner: false,
    },
  },
})
