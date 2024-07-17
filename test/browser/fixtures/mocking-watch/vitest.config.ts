import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const provider = process.env.PROVIDER || 'playwright'
const name =
  process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome')

export default defineConfig({
  optimizeDeps: {
    include: ['@vitest/cjs-lib', '@vitest/cjs-lib/lib'],
  },
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      fileParallelism: false,
      enabled: true,
      provider,
      name,
      headless: true,
    },
  },
})
