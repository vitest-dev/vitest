// import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['first.test.ts'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['second.test.ts'],
          testTimeout: 15_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            screenshotFailures: false,
          },
        },
      },
    ],
  },
})
