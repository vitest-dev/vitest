import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
  },
})
