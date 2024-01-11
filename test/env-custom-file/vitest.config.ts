import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: './custom.ts',
    environmentOptions: {
      custom: {
        option: 'config-option',
      },
    },
  },
})
