import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      tinyrainbow: '../../../../node_modules/.pnpm/node_modules/tinyrainbow',
    },
  },
})
