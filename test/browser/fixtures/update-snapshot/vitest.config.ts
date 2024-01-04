import { defineConfig } from 'vitest/config'

/*
manually test snapshot by
  pnpm -C test/browser test-fixtures --root fixtures/update-snapshot
*/

const provider = process.env.PROVIDER || 'webdriverio';
const browser = process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome');

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider,
      name: browser,
    },
  },
})
