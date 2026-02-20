# Configuring Playwright

To run tests using playwright, you need to install the [`@vitest/browser-playwright`](https://www.npmjs.com/package/@vitest/browser-playwright) npm package and specify its `playwright` export in the `test.browser.provider` property of your config:

```ts [vitest.config.js]
import { playwright } from '@vitest/browser-playwright'
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

You can configure the [`launchOptions`](https://playwright.dev/docs/api/class-browsertype#browser-type-launch), [`connectOptions`](https://playwright.dev/docs/api/class-browsertype#browser-type-connect) and [`contextOptions`](https://playwright.dev/docs/api/class-browser#browser-new-context) when calling `playwright` at the top level or inside instances:

```ts{7-14,21-26} [vitest.config.js]
import { playwright } from '@vitest/browser-playwright'
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

::: warning
Unlike Playwright test runner, Vitest opens a _single_ page to run all tests that are defined in the same file. This means that isolation is restricted to a single test file, not to every individual test.
:::

## launchOptions

These options are directly passed down to `playwright[browser].launch` command. You can read more about the command and available arguments in the [Playwright documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-launch).

::: warning
Vitest will ignore `launch.headless` option. Instead, use [`test.browser.headless`](/config/browser/headless).

Note that Vitest will push debugging flags to `launch.args` if [`--inspect`](/guide/cli#inspect) is enabled.
:::

## connectOptions

These options are directly passed down to `playwright[browser].connect` command. You can read more about the command and available arguments in the [Playwright documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-connect).

Use `connectOptions.wsEndpoint` to connect to an existing Playwright server instead of launching browsers locally. This is useful for running browsers in Docker, in CI, or on a remote machine.

::: warning

Vitest forwards `launchOptions` to Playwright server via the `x-playwright-launch-options` header. This works only if the remote Playwright server supports this header, for example when using the `playwright run-server` CLI.

:::

::: details Example: Running a Playwright Server in Docker
To run browsers in a Docker container (see [Playwright Docker guide](https://playwright.dev/docs/docker#remote-connection)):

Start a Playwright server using Docker Compose:

```yaml [docker-compose.yml]
services:
  playwright:
    image: mcr.microsoft.com/playwright:v1.58.1-noble
    command: /bin/sh -c "npx -y playwright@1.58.1 run-server --port 6677 --host 0.0.0.0"
    init: true
    ipc: host
    user: pwuser
    ports:
      - '6677:6677'
```

```sh
docker compose up -d
```

Then configure Vitest to connect to it. The [`exposeNetwork`](https://playwright.dev/docs/api/class-browsertype#browser-type-connect-option-expose-network) option lets the containerized browser reach Vitest's dev server on the host:

```ts [vitest.config.ts]
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: playwright({
        connectOptions: {
          wsEndpoint: 'ws://127.0.0.1:6677/',
          exposeNetwork: '<loopback>',
        },
      }),
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
})
```
:::

## contextOptions

Vitest creates a new context for every test file by calling [`browser.newContext()`](https://playwright.dev/docs/api/class-browsercontext). You can configure this behaviour by specifying [custom arguments](https://playwright.dev/docs/api/class-browser#browser-new-context).

::: tip
Note that the context is created for every _test file_, not every _test_ like in playwright test runner.
:::

::: warning
Vitest always sets `ignoreHTTPSErrors` to `true` in case your server is served via HTTPS and `serviceWorkers` to `'allow'` to support module mocking via [MSW](https://mswjs.io).

It is also recommended to use [`test.browser.viewport`](/config/browser/headless) instead of specifying it here as it will be lost when tests are running in headless mode.
:::

## `actionTimeout`

- **Default:** no timeout

This value configures the default timeout it takes for Playwright to wait until all accessibility checks pass and [the action](/api/browser/interactivity) is actually done.

You can also configure the action timeout per-action:

```ts
import { page, userEvent } from 'vitest/browser'

await userEvent.click(page.getByRole('button'), {
  timeout: 1_000,
})
```

## `persistentContext` <Version>4.1.0</Version> {#persistentcontext}

- **Type:** `boolean | string`
- **Default:** `false`

When enabled, Vitest uses Playwright's [persistent context](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context) instead of a regular browser context. This allows browser state (cookies, localStorage, DevTools settings, etc.) to persist between test runs.

::: warning
This option is ignored when running tests in parallel (e.g. when headless with [`fileParallelism`](/config/fileparallelism) enalbed) since persistent context cannot be shared across parallel sessions.
:::

- When set to `true`, the user data is stored in `./node_modules/.cache/vitest-playwright-user-data`
- When set to a string, the value is used as the path to the user data directory

```ts [vitest.config.js]
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: playwright({
        persistentContext: true,
        // or specify a custom directory:
        // persistentContext: './my-browser-data',
      }),
      instances: [{ browser: 'chromium' }],
    },
  },
})
```
