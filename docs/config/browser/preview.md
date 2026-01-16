# Configuring Preview

::: warning
The `preview` provider's main functionality is to show tests in a real browser environment. However, it does not support advanced browser automation features like multiple browser instances or headless mode. For more complex scenarios, consider using [Playwright](/config/browser/playwright) or [WebdriverIO](/config/browser/webdriverio).
:::

To see your tests running in a real browser, you need to install the [`@vitest/browser-preview`](https://www.npmjs.com/package/@vitest/browser-preview) npm package and specify its `preview` export in the `test.browser.provider` property of your config:

```ts [vitest.config.js]
import { preview } from '@vitest/browser-preview'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: preview(),
      instances: [{ browser: 'chromium' }]
    },
  },
})
```

This will open a new browser window using your default browser to run the tests. You can configure which browser to use by setting the `browser` property in the `instances` array. Vitest will try to open that browser automatically, but it might not work in some environments. In that case, you can manually open the provided URL in your desired browser.

## Differences with Other Providers

The preview provider has some limitations compared to other providers like [Playwright](/config/browser/playwright) or [WebdriverIO](/config/browser/webdriverio):

- It does not support headless mode; the browser window will always be visible.
- It does not support multiple instances of the same browser; each instance must use a different browser.
- It does not support advanced browser capabilities or options; you can only specify the browser name.
- It does not support CDP (Chrome DevTools Protocol) commands or other low-level browser interactions. Unlike Playwright or WebdriverIO, the [`userEvent`](/api/browser/interactivity) API is just re-exported from [`@testing-library/user-event`](https://www.npmjs.com/package/@testing-library/user-event) and does not have any special integration with the browser.
