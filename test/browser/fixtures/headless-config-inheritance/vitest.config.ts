import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider,
      instances,
    },
  },
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
})
