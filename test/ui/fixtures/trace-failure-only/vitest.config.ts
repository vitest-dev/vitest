import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
      headless: true,
      ui: false,
      traceView: {
        mode: 'failure-only',
      },
      screenshotFailures: false,
    },
  },
})
