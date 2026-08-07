import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  test: {
    include: ['*.test.ts'],
    browser: {
      enabled: true,
      instances: [{ browser: 'chromium' }],
      provider: playwright({
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? {
              executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
              args: ['--no-sandbox'],
            }
          : undefined,
      }),
      headless: true,
    },
  },
})
