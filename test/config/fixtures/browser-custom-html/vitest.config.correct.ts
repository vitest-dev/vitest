import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['browser-basic.test.ts'],
    browser: {
      instances: [{ browser: 'chromium' }],
      enabled: true,
      headless: true,
      provider: 'playwright',
      testerHtmlPath: './custom-html.html'
    },
  },
})