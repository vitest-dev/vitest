import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

// TEST_BROWSER=chromium pnpm -C test/browser test-fixtures --root fixtures/trace
// TEST_BROWSER=chromium pnpm -C test/browser test-fixtures --root fixtures/trace --ui --browser.headless
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: provider,
      instances: instances,
      traceView: true,
      screenshotFailures: false,
    },
  },
})
