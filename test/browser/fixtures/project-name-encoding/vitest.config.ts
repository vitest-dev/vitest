import { defineConfig } from 'vitest/config'
import { provider } from '../../settings'

export default defineConfig({
  test: {
    name: 'Components & Hooks',
    browser: {
      enabled: true,
      provider,
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
  },
})
