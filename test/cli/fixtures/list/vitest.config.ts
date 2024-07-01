import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      name: 'chromium',
      provider: 'playwright',
      headless: true,
      api: 7523,
    }
  },
})
