import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      openTelemetry: {
        // or use CLI flag --experimental.openTelemetry.enabled=true
        enabled: false,
        sdkPath: './otel.js',
      },
    },
    browser: {
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
