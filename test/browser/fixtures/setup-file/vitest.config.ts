import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const provider = process.env.PROVIDER || 'playwright'
const name =
  process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome')

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    setupFiles: ['./browser-setup.ts'],
    browser: {
      enabled: true,
      provider,
      name,
      headless: false,
    },
  },
})
