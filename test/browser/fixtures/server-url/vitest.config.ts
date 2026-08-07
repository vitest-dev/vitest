import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { instances, providers, provider } from '../../settings'

// test https by
//   TEST_HTTPS=1 pnpm test-fixtures --root fixtures/server-url

// ignore https errors due to self-signed certificate from plugin-basic-ssl
// https://playwright.dev/docs/api/class-browser#browser-new-context-option-ignore-https-errors
const configuredProvider = (function () {
  switch (provider.name) {
    case 'playwright': return providers.playwright()
    default: {
      throw new Error(`Invalid provider: ${provider.name}`)
    }
  }
})()

export default defineConfig({
  plugins: [
    !!process.env.TEST_HTTPS && basicSsl(),
  ],
  test: {
    // below the OS ephemeral port range (32768+ on Linux): a kernel-assigned
    // outbound socket holding the fixed port would make Vite silently bind
    // port+1 and fail the exact-port assertions
    api: process.env.TEST_HTTPS ? 31122 : 31133,
    browser: {
      enabled: true,
      provider: configuredProvider,
      instances,
    },
  },
  // separate cacheDir from test/browser/vite.config.ts
  // to prevent pre-bundling related flakiness on Webkit
  cacheDir: path.join(path.dirname(fileURLToPath(import.meta.url)), "node_modules/.vite")
})
