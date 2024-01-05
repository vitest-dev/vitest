import { defineConfig } from 'vitest/config'

const provider = process.env.PROVIDER || 'webdriverio';
const browser = process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome');

export default defineConfig({
  base: "/some/base/url",
  test: {
    browser: {
      enabled: true,
      provider,
      name: browser,
    },
  },
})
