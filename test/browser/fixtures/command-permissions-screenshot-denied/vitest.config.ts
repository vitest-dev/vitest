import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  server: {
    fs: {
      deny: ['my-secret.png'],
    },
  },
  test: {
    browser: {
      enabled: true,
      provider,
      instances,
      headless: true,
      screenshotFailures: false,
    },
  },
})
