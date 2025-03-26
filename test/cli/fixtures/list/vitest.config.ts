import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['basic.test.ts', 'math.test.ts'],
    browser: {
      instances: [{ browser: 'chromium' }],
      provider: 'playwright',
      headless: true,
      api: 7523,
    }
  },
})
