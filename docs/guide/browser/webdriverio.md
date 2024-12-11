# Configuring WebdriverIO

::: info Playwright vs WebdriverIO
If you do not already use WebdriverIO in your project, we recommend starting with [Playwright](/guide/browser/playwright) as it is easier to configure and has more flexible API.
:::

By default, TypeScript doesn't recognize providers options and extra `expect` properties. Make sure to reference `@vitest/browser/providers/webdriverio` so TypeScript can pick up definitions for custom options:

```ts [vitest.shims.d.ts]
/// <reference types="@vitest/browser/providers/webdriverio" />
```

Alternatively, you can also add it to `compilerOptions.types` field in your `tsconfig.json` file. Note that specifying anything in this field will disable [auto loading](https://www.typescriptlang.org/tsconfig/#types) of `@types/*` packages.

```json [tsconfig.json]
{
  "compilerOptions": {
    "types": ["@vitest/browser/providers/webdriverio"]
  }
}
```

Vitest opens a single page to run all tests in the same file. You can configure any property specified in `RemoteOptions` in `instances`:

```ts{9-12} [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      instances: [
        {
          browser: 'chrome',
          capabilities: {
            browserVersion: 86,
            platformName: 'Windows 10',
          },
        },
      ],
    },
  },
})
```

::: warning
Before Vitest 3, these options were located on `test.browser.providerOptions` property:

```ts [vitest.config.ts]
export default defineConfig({
  test: {
    browser: {
      providerOptions: {
        capabilities: {},
      },
    },
  },
})
```

`providerOptions` is deprecated in favour of `instances`.
:::

You can find most available options in the [WebdriverIO documentation](https://webdriver.io/docs/configuration/). Note that Vitest will ignore all test runner options because we only use `webdriverio`'s browser capabilities.

::: tip
Most useful options are located on `capabilities` object. WebdriverIO allows nested capabilities, but Vitest will ignore those options because we rely on a different mechanism to spawn several browsers.

Note that Vitest will ignore `capabilities.browserName`. Use [`test.browser.instances.name`](/guide/browser/config#browser-capabilities-name) instead.
:::
