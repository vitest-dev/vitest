import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    include: ['basic.test.ts', 'math.test.ts'],
    browser: {
      instances: [{ browser: 'chromium' }],
      provider: 'playwright',
      headless: true,
      api: 7523,
    }
  },
})
