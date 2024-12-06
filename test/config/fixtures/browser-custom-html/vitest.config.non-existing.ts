import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      name: 'chromium',
      enabled: true,
      headless: true,
      provider: 'playwright',
      testerHtmlPath: './some-non-existing-path'
    },
  },
})