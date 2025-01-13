# Browser Config Reference

You can change the browser configuration by updating the `test.browser` field in your [config file](/config/). An example of a simple config file:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [
        {
          browser: 'chromium',
          setupFile: './chromium-setup.js',
        },
      ],
    },
  },
})
```

Please, refer to the ["Config Reference"](/config/) article for different config examples.

::: warning
_All listed options_ on this page are located within a `test` property inside the configuration:

```ts [vitest.config.js]
export default defineConfig({
  test: {
    browser: {},
  },
})
```
:::

## browser.enabled

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser`, `--browser.enabled=false`

Run all tests inside a browser by default. Note that `--browser` only works if you have at least one [`browser.instances`](#browser-instances) item.

## browser.instances

- **Type:** `BrowserConfig`
- **Default:** `[{ browser: name }]`

Defines multiple browser setups. Every config has to have at least a `browser` field. The config supports your providers configurations:

- [Configuring Playwright](/guide/browser/playwright)
- [Configuring WebdriverIO](/guide/browser/webdriverio)

::: tip
To have a better type safety when using built-in providers, you should reference one of these types (for provider that you are using) in your [config file](/config/):

```ts
/// <reference types="@vitest/browser/providers/playwright" />
/// <reference types="@vitest/browser/providers/webdriverio" />
```
:::

In addition to that, you can also specify most of the [project options](/config/) (not marked with a <NonProjectOption /> icon) and some of the `browser` options like `browser.testerHtmlPath`.

::: warning
Every browser config inherits options from the root config:

```ts{3,9} [vitest.config.ts]
export default defineConfig({
  test: {
    setupFile: ['./root-setup-file.js'],
    browser: {
      enabled: true,
      testerHtmlPath: './custom-path.html',
      instances: [
        {
          // will have both setup files: "root" and "browser"
          setupFile: ['./browser-setup-file.js'],
          // implicitly has "testerHtmlPath" from the root config // [!code warning]
          // testerHtmlPath: './custom-path.html', // [!code warning]
        },
      ],
    },
  },
})
```

During development, Vitest supports only one [non-headless](#browser-headless) configuration. You can limit the headed project yourself by specifying `headless: false` in the config, or by providing the `--browser.headless=false` flag, or by filtering projects with `--project=chromium` flag.

For more examples, refer to the ["Multiple Setups" guide](/guide/browser/multiple-setups).
:::

List of available `browser` options:

- [`browser.headless`](#browser-headless)
- [`browser.locators`](#browser-locators)
- [`browser.viewport`](#browser-viewport)
- [`browser.testerHtmlPath`](#browser-testerhtmlpath)
- [`browser.screenshotDirectory`](#browser-screenshotdirectory)
- [`browser.screenshotFailures`](#browser-screenshotfailures)

By default, Vitest creates an array with a single element which uses the [`browser.name`](#browser-name) field as a `browser`. Note that this behaviour will be removed with Vitest 4.

Under the hood, Vitest transforms these instances into separate [test projects](/advanced/api/test-project) sharing a single Vite server for better caching performance.

## browser&#46;name <Badge type="danger">deprecated</Badge> {#browser-name}

- **Type:** `string`
- **CLI:** `--browser=safari`

::: danger
This API is deprecated an will be removed in Vitest 4. Please, use [`browser.instances`](#browser-instances) option instead.
:::

Run all tests in a specific browser. Possible options in different providers:

- `webdriverio`: `firefox`, `chrome`, `edge`, `safari`
- `playwright`: `firefox`, `webkit`, `chromium`
- custom: any string that will be passed to the provider

## browser.headless

- **Type:** `boolean`
- **Default:** `process.env.CI`
- **CLI:** `--browser.headless`, `--browser.headless=false`

Run the browser in a `headless` mode. If you are running Vitest in CI, it will be enabled by default.

## browser.isolate

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--browser.isolate`, `--browser.isolate=false`

Run every test in a separate iframe.

## browser.testerHtmlPath

- **Type:** `string`

A path to the HTML entry point. Can be relative to the root of the project. This file will be processed with [`transformIndexHtml`](https://vite.dev/guide/api-plugin#transformindexhtml) hook.

## browser.api

- **Type:** `number | { port?, strictPort?, host? }`
- **Default:** `63315`
- **CLI:** `--browser.api=63315`, `--browser.api.port=1234, --browser.api.host=example.com`

Configure options for Vite server that serves code in the browser. Does not affect [`test.api`](#api) option. By default, Vitest assigns port `63315` to avoid conflicts with the development server, allowing you to run both in parallel.

## browser.provider <Badge type="warning">experimental</Badge> {#browser-provider}

- **Type:** `'webdriverio' | 'playwright' | 'preview' | string`
- **Default:** `'preview'`
- **CLI:** `--browser.provider=playwright`

::: danger ADVANCED API
The provider API is highly experimental and can change between patches. If you just need to run tests in a browser, use the [`browser.instances`](#browser-instances) option instead.
:::

Path to a provider that will be used when running browser tests. Vitest provides three providers which are `preview` (default), `webdriverio` and `playwright`. Custom providers should be exported using `default` export and have this shape:

```ts
export interface BrowserProvider {
  name: string
  supportsParallelism: boolean
  getSupportedBrowsers: () => readonly string[]
  beforeCommand?: (command: string, args: unknown[]) => Awaitable<void>
  afterCommand?: (command: string, args: unknown[]) => Awaitable<void>
  getCommandsContext: (sessionId: string) => Record<string, unknown>
  openPage: (sessionId: string, url: string, beforeNavigate?: () => Promise<void>) => Promise<void>
  getCDPSession?: (sessionId: string) => Promise<CDPSession>
  close: () => Awaitable<void>
  initialize(
    ctx: TestProject,
    options: BrowserProviderInitializationOptions
  ): Awaitable<void>
}
```

## browser.providerOptions <Badge type="danger">deprecated</Badge> {#browser-provideroptions}

- **Type:** `BrowserProviderOptions`

::: danger
This API is deprecated an will be removed in Vitest 4. Please, use [`browser.instances`](#browser-instances) option instead.
:::

Options that will be passed down to provider when calling `provider.initialize`.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      providerOptions: {
        launch: {
          devtools: true,
        },
      },
    },
  },
})
```

::: tip
To have a better type safety when using built-in providers, you should reference one of these types (for provider that you are using) in your [config file](/config/):

```ts
/// <reference types="@vitest/browser/providers/playwright" />
/// <reference types="@vitest/browser/providers/webdriverio" />
```
:::

## browser.ui

- **Type:** `boolean`
- **Default:** `!isCI`
- **CLI:** `--browser.ui=false`

Should Vitest UI be injected into the page. By default, injects UI iframe during development.

## browser.viewport

- **Type:** `{ width, height }`
- **Default:** `414x896`

Default iframe's viewport.

## browser.locators

Options for built-in [browser locators](/guide/browser/locators).

### browser.locators.testIdAttribute

- **Type:** `string`
- **Default:** `data-testid`

Attribute used to find elements with `getByTestId` locator.

## browser.screenshotDirectory

- **Type:** `string`
- **Default:** `__snapshots__` in the test file directory

Path to the screenshots directory relative to the `root`.

## browser.screenshotFailures

- **Type:** `boolean`
- **Default:** `!browser.ui`

Should Vitest take screenshots if the test fails.

## browser.orchestratorScripts

- **Type:** `BrowserScript[]`
- **Default:** `[]`

Custom scripts that should be injected into the orchestrator HTML before test iframes are initiated. This HTML document only sets up iframes and doesn't actually import your code.

The script `src` and `content` will be processed by Vite plugins. Script should be provided in the following shape:

```ts
export interface BrowserScript {
  /**
   * If "content" is provided and type is "module", this will be its identifier.
   *
   * If you are using TypeScript, you can add `.ts` extension here for example.
   * @default `injected-${index}.js`
   */
  id?: string
  /**
   * JavaScript content to be injected. This string is processed by Vite plugins if type is "module".
   *
   * You can use `id` to give Vite a hint about the file extension.
   */
  content?: string
  /**
   * Path to the script. This value is resolved by Vite so it can be a node module or a file path.
   */
  src?: string
  /**
   * If the script should be loaded asynchronously.
   */
  async?: boolean
  /**
   * Script type.
   * @default 'module'
   */
  type?: string
}
```

## browser.testerScripts

- **Type:** `BrowserScript[]`
- **Default:** `[]`

::: danger
This API is deprecated an will be removed in Vitest 4. Please, use [`browser.testerHtmlPath`](#browser-testerhtmlpath) field instead.
:::

Custom scripts that should be injected into the tester HTML before the tests environment is initiated. This is useful to inject polyfills required for Vitest browser implementation. It is recommended to use [`setupFiles`](#setupfiles) in almost all cases instead of this.

The script `src` and `content` will be processed by Vite plugins.

## browser.commands

- **Type:** `Record<string, BrowserCommand>`
- **Default:** `{ readFile, writeFile, ... }`

Custom [commands](/guide/browser/commands) that can be imported during browser tests from `@vitest/browser/commands`.

## browser.connectTimeout

- **Type:** `number`
- **Default:** `60_000`

The timeout in milliseconds. If connection to the browser takes longer, the test suite will fail.

::: info
This is the time it should take for the browser to establish the WebSocket connection with the Vitest server. In normal circumstances, this timeout should never be reached.
:::
