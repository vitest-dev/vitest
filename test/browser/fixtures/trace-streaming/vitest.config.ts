import { defineConfig } from 'vitest/config'
import { instances, provider } from '../../settings'

export default defineConfig({
  test: {
    includeTaskLocation: true,
    browser: {
      enabled: true,
      provider,
      instances,
      headless: true,
      traceView: {
        enabled: true,
      },
      screenshotFailures: false,
    },
  },
})
