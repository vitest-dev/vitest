# Configuring WebdriverIO

::: info Playwright vs WebdriverIO
If you do not already use WebdriverIO in your project, we recommend starting with [Playwright](/guide/browser/playwright) as it is easier to configure and has more flexible API.
:::

To run tests using WebdriverIO, you need to specify it in the `test.browser.provider` property in your config:

```ts [vitest.config.js]
import { webdriverio } from '@vitest/browser/providers/webdriverio'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: webdriverio(),
      instances: [{ browser: 'chrome' }]
    },
  },
})
```

Vitest opens a single page to run all tests in the same file. You can configure all the parameters that [`remote`](https://webdriver.io/docs/api/modules/#remoteoptions-modifier) function accepts:

```ts{8-12,19-23} [vitest.config.js]
import { webdriverio } from '@vitest/browser/providers/webdriverio'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      // shared provider options between all instances
      provider: webdriverio({
        capabilities: {
          browserVersion: '82',
        },
      }),
      instances: [
        { browser: 'chrome' },
        {
          browser: 'firefox',
          // overriding options only for a single instance
          // this will NOT merge options with the parent one
          provider: webdriverio({
            'moz:firefoxOptions': {
              args: ['--disable-gpu'],
            },
          })
        }
      ],
    },
  },
})
```

You can find most available options in the [WebdriverIO documentation](https://webdriver.io/docs/configuration/). Note that Vitest will ignore all test runner options because we only use `webdriverio`'s browser capabilities.

::: tip
Most useful options are located on `capabilities` object. WebdriverIO allows nested capabilities, but Vitest will ignore those options because we rely on a different mechanism to spawn several browsers.

Note that Vitest will ignore `capabilities.browserName`. Use [`test.browser.instances.browser`](/guide/browser/config#browser-capabilities-name) instead.
:::
