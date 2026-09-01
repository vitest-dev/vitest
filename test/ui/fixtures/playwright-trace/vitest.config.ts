import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium', viewport: { width: 320, height: 240 } }],
      headless: true,
      trace: 'on',
    },
  },
})
