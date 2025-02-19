import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      instances: [{ browser: 'chromium' }],
      enabled: true,
      headless: true,
      provider: 'playwright',
      testerHtmlPath: './some-non-existing-path'
    },
  },
})