import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    ui: true,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
      headless: true,
      ui: false,
      traceView: {
        enabled: true,
        // enabled only on html reporter e2e
        // inlineImages: true,
      },
      screenshotFailures: false,
    },
  },
})
