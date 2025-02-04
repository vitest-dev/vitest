import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url'
import { instances, provider } from '../../../settings'

// BROWSER=chromium pnpm -C test/browser test-fixtures --root fixtures/mocking-out-of-root/project1

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  root: import.meta.dirname,
  test: {
    browser: {
      enabled: true,
      provider: provider,
      screenshotFailures: false,
      instances,
    },
  },
})
