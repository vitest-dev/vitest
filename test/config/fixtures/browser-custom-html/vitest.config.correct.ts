import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['browser-basic.test.ts'],
    browser: {
      name: 'chromium',
      enabled: true,
      headless: true,
      provider: 'playwright',
      testerHtmlPath: './custom-html.html'
    },
  },
})