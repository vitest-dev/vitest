import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    headers: {
      'content-security-policy': "script-src 'self' 'unsafe-inline'",
    },
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  },
})
