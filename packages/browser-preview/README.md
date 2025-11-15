# @vitest/browser-preview

[![NPM version](https://img.shields.io/npm/v/@vitest/browser-preview?color=a1b858&label=)](https://www.npmjs.com/package/@vitest/browser-preview)

See how your tests look like in a real browser. For proper and stable browser testing, we recommend running tests in a headless browser in your CI instead. For this, you should use either:

- [@vitest/browser-playwright](https://www.npmjs.com/package/@vitest/browser-playwright) - run tests using [playwright](https://playwright.dev/)
- [@vitest/browser-webdriverio](https://www.npmjs.com/package/@vitest/browser-webdriverio) - run tests using [webdriverio](https://webdriver.io/)

## Installation

Install the package with your favorite package manager:

```sh
npm install -D @vitest/browser-preview
# or
yarn add -D @vitest/browser-preview
# or
pnpm add -D @vitest/browser-preview
```

Then specify it in the `browser.provider` field of your Vitest configuration:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { preview } from '@vitest/browser-preview'

export default defineConfig({
  test: {
    browser: {
      provider: preview(),
      instances: [
        { browser: 'chromium' },
      ],
    },
  },
})
```

Then run Vitest in the browser mode:

```sh
npx vitest --browser
```

If browser didn't open automatically, follow the link in the terminal to open the browser preview.

[GitHub](https://github.com/vitest-dev/vitest/tree/main/packages/browser-preview) | [Documentation](https://vitest.dev/guide/browser/)
