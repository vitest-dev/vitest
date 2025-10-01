import { playwright } from '@vitest/browser-playwright'
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    browser: {
      enabled: true,
      instances: [{ browser: process.env.BROWSER as 'chromium' || 'chromium' }],
      headless: true,
      provider: playwright(),
    },
  },
})
