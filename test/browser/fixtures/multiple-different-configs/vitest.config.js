import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url'

const provider = process.env.PROVIDER || 'playwright'

export default defineConfig({
  clearScreen: false,
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    browser: {
      provider: provider,
      enabled: true,
      headless: true,
      screenshotFailures: false,
      instances: [
        {
          browser: provider === 'playwright' ? 'chromium' : 'chrome',
          testerHtmlPath: './customTester.html',
          provide: {
            providedVar: true,
          },
          name: 'chromium',
        },
        {
          browser: 'firefox',
          provide: {
            firefoxValue: true,
          },
        },
      ],
    },
  },
})
