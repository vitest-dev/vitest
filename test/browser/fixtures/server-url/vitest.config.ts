import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
  // separate cacheDir from test/browser/vite.config.ts
  // to prevent pre-bundling related flakiness on Webkit
  cacheDir: path.join(path.dirname(fileURLToPath(import.meta.url)), "node_modules/.vite")
})
