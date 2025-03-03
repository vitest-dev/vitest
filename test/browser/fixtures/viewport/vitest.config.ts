import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// pnpm -C test/browser test-fixtures --root fixtures/viewport --browser.ui=false
// pnpm -C test/browser test-fixtures --root fixtures/viewport --browser.headless=true

const provider = process.env.PROVIDER || 'playwright'
const name =
  process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome')

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name,
      provider,
      viewport: { width: 3000, height: 400 }
    },
  },
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
})
