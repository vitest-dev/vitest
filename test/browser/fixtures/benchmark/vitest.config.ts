import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const provider = process.env.PROVIDER || 'playwright'
const name =
  process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome')

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider,
      name,
    },
  },
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
})
