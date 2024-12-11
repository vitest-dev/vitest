# Configuring Playwright

By default, TypeScript doesn't recognize providers options and extra `expect` properties. Make sure to reference `@vitest/browser/providers/playwright` so TypeScript can pick up definitions for custom options:

```ts [vitest.shims.d.ts]
/// <reference types="@vitest/browser/providers/playwright" />
```

Alternatively, you can also add it to `compilerOptions.types` field in your `tsconfig.json` file. Note that specifying anything in this field will disable [auto loading](https://www.typescriptlang.org/tsconfig/#types) of `@types/*` packages.

```json [tsconfig.json]
{
  "compilerOptions": {
    "types": ["@vitest/browser/providers/playwright"]
  }
}
```

Vitest opens a single page to run all tests in the same file. You can configure the `launch` and `context` properties in `instances`:

```ts{9-10} [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      instances: [
        {
          browser: 'firefox',
          launch: {},
          context: {},
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
        launch: {},
        context: {},
      },
    },
  },
})
```

`providerOptions` is deprecated in favour of `instances`.
:::

## launch

These options are directly passed down to `playwright[browser].launch` command. You can read more about the command and available arguments in the [Playwright documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-launch).

::: warning
Vitest will ignore `launch.headless` option. Instead, use [`test.browser.headless`](/guide/browser/config#browser-headless).

Note that Vitest will push debugging flags to `launch.args` if [`--inspect`](/guide/cli#inspect) is enabled.
:::

## context

Vitest creates a new context for every test file by calling [`browser.newContext()`](https://playwright.dev/docs/api/class-browsercontext). You can configure this behaviour by specifying [custom arguments](https://playwright.dev/docs/api/class-apirequest#api-request-new-context).

::: tip
Note that the context is created for every _test file_, not every _test_ like in playwright test runner.
:::

::: warning
Vitest awlays sets `ignoreHTTPSErrors` to `true` in case your server is served via HTTPS and `serviceWorkers` to `'allow'` to support module mocking via [MSW](https://mswjs.io).

It is also recommended to use [`test.browser.viewport`](/guide/browser/config#browser-headless) instead of specifying it here as it will be lost when tests are running in headless mode.
:::

## `actionTimeout` <Version>3.0.0</Version>

- **Default:** no timeout, 1 second before 3.0.0

This value configures the default timeout it takes for Playwright to wait until all accessibility checks pass and [the action](/guide/browser/interactivity-api) is actually done.

You can also configure the action timeout per-action:

```ts
import { page, userEvent } from '@vitest/browser/context'

await userEvent.click(page.getByRole('button'), {
  timeout: 1_000,
})
```
