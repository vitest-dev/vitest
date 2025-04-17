import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

// pnpm -C test/browser test-fixtures --root fixtures/viewport --browser.ui=false
// pnpm -C test/browser test-fixtures --root fixtures/viewport --browser.headless=true

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider,
      instances: instances.map(instance => ({
        ...instance,
        viewport: { width: 3000, height: 400 }
      })),

    },
  },
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
})
