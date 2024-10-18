import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'test:html',
      transformIndexHtml() {
        return [
          {
            tag: 'script',
            children: 'window.CUSTOM_INJECTED = true',
            injectTo: 'head',
          }
        ]
      },
    },
  ],
  test: {
    include: ['./browser-custom.test.ts'],
    browser: {
      name: 'chromium',
      enabled: true,
      headless: true,
      provider: 'playwright',
    },
  },
})