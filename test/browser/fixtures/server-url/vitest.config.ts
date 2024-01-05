import { defineConfig } from 'vitest/config'
import basicSsl from '@vitejs/plugin-basic-ssl'

// test https by
//   TEST_HTTPS=1 pnpm test-fixtures --root fixtures/server-url

const provider = process.env.PROVIDER || 'webdriverio';
const browser = process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome');

export default defineConfig({
  plugins: [
    !!process.env.TEST_HTTPS && basicSsl(),
  ],
  test: {
    browser: {
      enabled: true,
      provider,
      name: browser,
    },
  },
})
