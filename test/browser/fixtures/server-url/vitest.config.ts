import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { instances, provider } from '../../settings'

// test https by
//   TEST_HTTPS=1 pnpm test-fixtures --root fixtures/server-url

// ignore https errors due to self-signed certificate from plugin-basic-ssl
// https://playwright.dev/docs/api/class-browser#browser-new-context-option-ignore-https-errors
// https://webdriver.io/docs/configuration/#strictssl and acceptInsecureCerts in https://webdriver.io/docs/api/browser/#properties
const providerOptions = (function () {
  switch (provider) {
    case 'playwright': return { page: { ignoreHTTPSErrors: true } }
    case 'webdriverio': return { strictSSL: false, capabilities: { acceptInsecureCerts: true } }
  }
})() as any

export default defineConfig({
  plugins: [
    !!process.env.TEST_HTTPS && basicSsl(),
  ],
  test: {
    browser: {
      api: process.env.TEST_HTTPS ? 51122 : 51133,
      enabled: true,
      provider,
      instances: instances.map(instance => ({
        ...instance,
        ...providerOptions,
      })),
    },
  },
  // separate cacheDir from test/browser/vite.config.ts
  // to prevent pre-bundling related flakiness on Webkit
  cacheDir: path.join(path.dirname(fileURLToPath(import.meta.url)), "node_modules/.vite")
})
