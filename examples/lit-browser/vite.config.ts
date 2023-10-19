/// <reference types="vitest" />

import { defineConfig } from 'vite'
import { isCI } from 'std-env'

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    exclude: ['lit', 'lit/decorators.js'],
  },
  test: {
    globals: true,
    browser: {
      enabled: true,
      enableUI: !isCI,
      headless: isCI,
      name: 'chrome',
      provider: process.env.BROWSER_PROVIDER || 'webdriverio',
    },
  },
})
