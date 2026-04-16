import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

// TEST_BROWSER=chromium pnpm -C test/browser test-fixtures --root fixtures/trace
// TEST_BROWSER=chromium pnpm -C test/browser test-fixtures --root fixtures/trace --ui --browser.headless
// TEST_BROWSER=chromium pnpm -C test/browser test-fixtures --root fixtures/trace --reporter=html --browser.headless --run
// pnpm dlx serve test/browser/fixtures/trace/html
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: provider,
      instances: instances,
      traceView: {
        enabled: true,
        inlineImages: true,
        recordCanvas: true,
      },
      screenshotFailures: false,
    },
  },
})
