import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'test:html',
      transformIndexHtml() {
        return [
          {
            tag: 'script',
            injectTo: 'head-prepend',
            attrs: {
              type: 'importmap'
            },
            children: JSON.stringify({
              "imports": {
                "some-lib": "https://vitest.dev/some-lib",
              },
            })
          },
          {
            tag: 'script',
            children: 'window.CUSTOM_INJECTED = true',
            injectTo: 'head',
          },
        ]
      },
    },
  ],
  test: {
    include: ['./browser-custom.test.ts'],
    browser: {
      instances: [{ browser: 'chromium' }],
      enabled: true,
      headless: true,
      provider: 'playwright',
      testerHtmlPath: './custom-html.html',
    },
  },
})