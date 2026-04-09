import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { provider, instances } from '../../settings'

export default defineConfig({
  cacheDir: fileURLToPath(new URL("./node_modules/.vite", import.meta.url)),
  test: {
    // TODO:
    // playwright/firefox doesn't seem to have mouse state isolation per frames.
    // for example, the following can fail by race conditions:
    // BROWSER=firefox pnpm -C test/browser/ test-fixtures --root fixtures/user-event-hover --browser.headless --fileParallelism
    fileParallelism: false,
    browser: {
      enabled: true,
      provider,
      instances,
    },
  },
})
