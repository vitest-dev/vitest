# Configuring WebdriverIO

::: info Community maintained
The WebdriverIO provider ([`@vitest/browser-webdriverio`](https://github.com/vitest-community/vitest-webdriverio)) is maintained by the Vitest community in the [`vitest-community`](https://github.com/vitest-community) organization, separately from the core Vitest packages. Please report provider-specific issues to its repository.
:::

To run tests using WebdriverIO, you need to install the [`@vitest/browser-webdriverio`](https://npmx.dev/package/@vitest/browser-webdriverio) npm package and specify its `webdriverio` export in the `test.browser.provider` property of your config:

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

Note that Vitest will ignore `capabilities.browserName`; use [`test.browser.instances.browser`](/config/browser/instances#browser) instead.
:::

## Headful Chrome in CI

Vitest enables [`browser.headless`](/config/browser/headless) automatically in CI.
If you explicitly set `headless: false` for Chrome on a Linux CI runner, Chrome
still needs a display server. Without one, WebDriverIO or ChromeDriver can fail
with a misleading error such as `session not created: probably user data
directory is already in use`.

Run the test command through `xvfb-run` when you need headful Chrome in GitHub
Actions or another Linux CI environment:

```bash
xvfb-run npm test
```

Alternatively, keep `browser.headless` enabled in CI and use headful mode only
for local debugging.
