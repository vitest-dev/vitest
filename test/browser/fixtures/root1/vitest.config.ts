import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const provider = process.env.PROVIDER || 'webdriverio';
const browser = process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome');

export default defineConfig({
  cacheDir: path.join(path.dirname(fileURLToPath(import.meta.url)), "node_modules/.vite"),
  test: {
    browser: {
      enabled: true,
      provider,
      name: browser,
    },
  },
})
