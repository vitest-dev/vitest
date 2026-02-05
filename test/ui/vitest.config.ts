import { resolve } from 'node:path'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reportOnFailure: true,
    },
    tags: [
      { name: 'db' },
      { name: 'flaky' },
    ],
    projects: [{
      extends: true,
      test: {
        name: 'fixtures',
        dir: './fixtures',
        environment: 'happy-dom',
      },
    }, {
      extends: true,
      test: {
        name: 'browser',
        dir: './fixtures-browser',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright(),
          instances: [{ browser: 'chromium' }],
          screenshotFailures: false,
          expect: {
            toMatchScreenshot: {
              resolveScreenshotPath: ({ root, testFileDirectory, arg, ext }) => resolve(root, testFileDirectory, `${arg}${ext}`),
            },
          },
        },
      },
    }],
  },
})
