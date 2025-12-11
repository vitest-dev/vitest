/// <reference types="vitest/config" />

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    // Lit recommends using browser environment for testing
    // https://lit.dev/docs/tools/testing/#testing-in-the-browser
    browser: {
      enabled: true,
      provider: playwright({
        persistentContext: true,
      }),
      instances: [
        { browser: 'chromium' },
      ],
    },
  },
})
