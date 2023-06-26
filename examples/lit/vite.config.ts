/// <reference types="vitest" />

import { defineConfig } from 'vite'
import { isCI } from 'std-env'

// https://vitejs.dev/config/
export default defineConfig(() => {
  if (process.env.IN_BROWSER_PROVIDER === 'true') {
    return {
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
    }
  }

  return {
    test: {
      globals: true,
      environment: 'jsdom',
    },
  }
})
