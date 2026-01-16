# @vitest/browser-webdriverio

[![NPM version](https://img.shields.io/npm/v/@vitest/browser-webdriverio?color=a1b858&label=)](https://www.npmjs.com/package/@vitest/browser-webdriverio)

Run your Vitest [browser tests](https://vitest.dev/guide/browser/) using [webdriverio](https://webdriver.io/docs/api/browser) API. Note that Vitest does not use webdriverio as a test runner, but only as a browser provider.

We recommend using this package if you are already using webdriverio in your project.

## Installation

Install the package with your favorite package manager:

```sh
npm install -D @vitest/browser-webdriverio
# or
yarn add -D @vitest/browser-webdriverio
# or
pnpm add -D @vitest/browser-webdriverio
```

Then specify it in the `browser.provider` field of your Vitest configuration:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { webdriverio } from '@vitest/browser-webdriverio'

export default defineConfig({
  test: {
    browser: {
      provider: webdriverio({
        // ...custom webdriverio options
      }),
      instances: [
        { browser: 'chrome' },
      ],
    },
  },
})
```

Then run Vitest in the browser mode:

```sh
npx vitest --browser
```

[GitHub](https://github.com/vitest-dev/vitest/tree/main/packages/browser-webdriverio) | [Documentation](https://vitest.dev/config/browser/webdriverio)
