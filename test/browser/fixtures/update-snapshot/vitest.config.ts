import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/*
manually test snapshot by
  pnpm -C test/browser test-fixtures --root fixtures/update-snapshot
*/

const provider = process.env.PROVIDER || 'playwright'
const browser =
  process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome')

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider,
      name: browser,
    },
  },
  cacheDir: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'node_modules/.vite'
  ),
})
