import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url'

// pnpm -C test/browser test-fixtures --root fixtures/mocking-out-of-root/project1

const provider = process.env.PROVIDER || 'playwright'

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  root: import.meta.dirname,
  test: {
    browser: {
      enabled: true,
      provider: provider,
      screenshotFailures: false,
      instances: [
        {
          name: 'chromium',
          browser: provider === 'playwright' ? 'chromium' : 'chrome',
        },
      ],
    },
  },
})
