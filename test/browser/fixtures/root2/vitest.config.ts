import { defineConfig } from 'vitest/config'

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
