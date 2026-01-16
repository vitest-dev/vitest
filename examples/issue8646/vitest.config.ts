/// <reference types="vitest/config" />

import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      instances: [
        { browser: 'chromium' },
      ],
      provider: playwright(),
      headless: true,
    },
  },
})
