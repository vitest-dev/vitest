import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'custom',
    environmentOptions: {
      custom: {
        option: 'config-option',
      },
    },
  },
})
