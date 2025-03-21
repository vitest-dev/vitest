import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { provider } from '../../settings'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider,
    },
  },
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
})
