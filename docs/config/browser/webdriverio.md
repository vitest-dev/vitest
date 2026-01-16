# Configuring WebdriverIO

::: info Playwright vs WebdriverIO
If you do not already use WebdriverIO in your project, we recommend starting with [Playwright](/config/browser/playwright) as it is easier to configure and has more flexible API.
:::

To run tests using WebdriverIO, you need to install the [`@vitest/browser-webdriverio`](https://www.npmjs.com/package/@vitest/browser-webdriverio) npm package and specify its `webdriverio` export in the `test.browser.provider` property of your config:

```ts [vitest.config.js]
import { webdriverio } from '@vitest/browser-webdriverio'
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

You can configure all the parameters that [`remote`](https://webdriver.io/docs/api/modules/#remoteoptions-modifier) function accepts:

```ts{8-12,19-25} [vitest.config.js]
import { webdriverio } from '@vitest/browser-webdriverio'
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
            capabilities: {
              'moz:firefoxOptions': {
                args: ['--disable-gpu'],
              },
            },
          })
        },
      ],
    },
  },
})
```

You can find most available options in the [WebdriverIO documentation](https://webdriver.io/docs/configuration/). Note that Vitest will ignore all test runner options because we only use `webdriverio`'s browser capabilities.

::: tip
Most useful options are located on `capabilities` object. WebdriverIO allows nested capabilities, but Vitest will ignore those options because we rely on a different mechanism to spawn several browsers.

Note that Vitest will ignore `capabilities.browserName` — use [`test.browser.instances.browser`](/config/browser/instances#browser) instead.
:::
