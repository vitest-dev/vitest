import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

// TEST_BROWSER=chromium pnpm -C test/browser test-fixtures --root fixtures/trace-aria
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: provider,
      instances: instances,
      traceView: {
        enabled: true,
        ariaSnapshot: true,
      },
      screenshotFailures: false,
    },
  },
})
