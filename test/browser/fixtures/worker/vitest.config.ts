import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { provider, instances } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
    },
  },
})
