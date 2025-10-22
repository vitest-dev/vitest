# browser.enabled

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser`, `--browser.enabled=false`

Run all tests inside a [browser](/guide/browser) by default. If you are configuring other browser options via the CLI, you can use `--browser.enabled` alongside them instead of a `--browser`:

```sh
vitest --browser.enabled --browser.headless
```

::: warning
Note that to enable [Browser Mode](/guide/browser), you also have to specify the [`provider`](/config/browser/provider) and at least one [`instance`](/config/browser/instances). Available providers:

- [playwright](/config/browser/playwright)
- [webdriverio](/config/browser/webdriverio)
- [preview](/config/browser/preview)
:::

## Example

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
      ],
    },
  },
})
```

If you are using TypeScript, the `browser` field in `instances` will have auto complete depending on your provider.
