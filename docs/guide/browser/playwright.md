# Configuring Playwright

To run tests using playwright, you need to specify it in the `test.browser.provider` property in your config:

```ts [vitest.config.js]
import { playwright } from '@vitest/browser/providers/playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: playwright(),
      instances: [{ browser: 'chromium' }]
    },
  },
})
```

Vitest opens a single page to run all tests in the same file. You can configure the `launch`, `connect` and `context` when calling `playwright` at the top level or inside instances:

```ts{7-15,22-27} [vitest.config.js]
import { playwright } from '@vitest/browser/providers/playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      // shared provider options between all instances
      provider: playwright({
        launchOptions: {
          slowMo: 50,
          channel: 'chrome-beta',
        },
        actionTimeout: 5_000,
      }),
      instances: [
        { browser: 'chromium' },
        {
          browser: 'firefox',
          // overriding options only for a single instance
          // this will NOT merge options with the parent one
          provider: playwright({
            launchOptions: {
              firefoxUserPrefs: {
                'browser.startup.homepage': 'https://example.com',
              },
            },
          })
        }
      ],
    },
  },
})
```

## launchOptions

These options are directly passed down to `playwright[browser].launch` command. You can read more about the command and available arguments in the [Playwright documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-launch).

::: warning
Vitest will ignore `launch.headless` option. Instead, use [`test.browser.headless`](/guide/browser/config#browser-headless).

Note that Vitest will push debugging flags to `launch.args` if [`--inspect`](/guide/cli#inspect) is enabled.
:::

## connectOptions

These options are directly passed down to `playwright[browser].connect` command. You can read more about the command and available arguments in the [Playwright documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-connect).

::: warning
Since this command connects to an existing Playwright server, any `launch` options will be ignored.
:::

## contextOptions

Vitest creates a new context for every test file by calling [`browser.newContext()`](https://playwright.dev/docs/api/class-browsercontext). You can configure this behaviour by specifying [custom arguments](https://playwright.dev/docs/api/class-apirequest#api-request-new-context).

::: tip
Note that the context is created for every _test file_, not every _test_ like in playwright test runner.
:::

::: warning
Vitest always sets `ignoreHTTPSErrors` to `true` in case your server is served via HTTPS and `serviceWorkers` to `'allow'` to support module mocking via [MSW](https://mswjs.io).

It is also recommended to use [`test.browser.viewport`](/guide/browser/config#browser-headless) instead of specifying it here as it will be lost when tests are running in headless mode.
:::

## `actionTimeout`

- **Default:** no timeout

This value configures the default timeout it takes for Playwright to wait until all accessibility checks pass and [the action](/guide/browser/interactivity-api) is actually done.

You can also configure the action timeout per-action:

```ts
import { page, userEvent } from '@vitest/browser/context'

await userEvent.click(page.getByRole('button'), {
  timeout: 1_000,
})
```
