import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      openTelemetry: {
        // enable via CLI flag --experimental.openTelemetry.enabled=true
        enabled: false,
        sdkPath: './otel.js',
        browserSdkPath: './otel-browser.js',
      },
    },
    browser: {
      // enable via CLI flag --browser.enabled=true
      enabled: false,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
