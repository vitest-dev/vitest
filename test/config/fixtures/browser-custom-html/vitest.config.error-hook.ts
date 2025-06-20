import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'test:html',
      transformIndexHtml() {
        throw new Error('expected error in transformIndexHtml')
      },
    },
  ],
  test: {
    include: ['./browser-basic.test.ts'],
    browser: {
      instances: [{ browser: 'chromium' }],
      enabled: true,
      headless: true,
      provider: 'playwright',
      testerHtmlPath: './custom-html.html'
    },
  },
})