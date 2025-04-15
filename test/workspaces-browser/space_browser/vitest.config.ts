import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    browser: {
      enabled: true,
      instances: [{ browser: process.env.BROWSER || 'chromium' }],
      headless: true,
      provider: process.env.PROVIDER || 'playwright',
    },
  },
})
