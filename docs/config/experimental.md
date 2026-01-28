---
title: experimental | Config
outline: deep
---

# experimental

## experimental.fsModuleCache <Version type="experimental">4.0.11</Version> {#experimental-fsmodulecache}

::: tip FEEDBACK
Please leave feedback regarding this feature in a [GitHub Discussion](https://github.com/vitest-dev/vitest/discussions/9221).
:::

- **Type:** `boolean`
- **Default:** `false`

Enabling this option allows Vitest to keep cached modules on the file system, making tests run faster between reruns.

You can delete the old cache by running [`vitest --clearCache`](/guide/cli#clearcache).

::: warning BROWSER SUPPORT
At the moment, this option does not affect [the browser](/guide/browser/).
:::

You can debug if your modules are cached by running vitest with a `DEBUG=vitest:cache:fs` environment variable:

```shell
DEBUG=vitest:cache:fs vitest --experimental.fsModuleCache
```

### Known Issues

Vitest creates a persistent file hash based on file content, its id, Vite's environment configuration and coverage status. Vitest tries to use as much information as it has about the configuration, but it is still incomplete. At the moment, it is not possible to track your plugin options because there is no standard interface for it.

If you have a plugin that relies on things outside the file content or the public configuration (like reading another file or a folder), it's possible that the cache will get stale. To work around that, you can define a [cache key generator](/api/advanced/plugin#definecachekeygenerator) to specify a dynamic option or to opt out of caching for that module:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'vitest-cache',
      configureVitest({ experimental_defineCacheKeyGenerator }) {
        experimental_defineCacheKeyGenerator(({ id, sourceCode }) => {
          // never cache this id
          if (id.includes('do-not-cache')) {
            return false
          }

          // cache this file based on the value of a dynamic variable
          if (sourceCode.includes('myDynamicVar')) {
            return process.env.DYNAMIC_VAR_VALUE
          }
        })
      }
    }
  ],
  test: {
    experimental: {
      fsModuleCache: true,
    },
  },
})
```

If you are a plugin author, consider defining a [cache key generator](/api/advanced/plugin#definecachekeygenerator) in your plugin if it can be registered with different options that affect the transform result.

On the other hand, if your plugin should not affect the cache key, you can opt out by setting `api.vitest.experimental.ignoreFsModuleCache` to `true`:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'vitest-cache',
      api: {
        vitest: {
          experimental: {
            ignoreFsModuleCache: true,
          },
        },
      },
    },
  ],
  test: {
    experimental: {
      fsModuleCache: true,
    },
  },
})
```

Note that you can still define the cache key generator even if the plugin opts out of module caching.

## experimental.fsModuleCachePath <Version type="experimental">4.0.11</Version> {#experimental-fsmodulecachepath}

- **Type:** `string`
- **Default:** `'node_modules/.experimental-vitest-cache'`

Directory where the file system cache is located.

By default, Vitest will try to find the workspace root and store the cache inside the `node_modules` folder. The root is based on your package manager's lockfile (for example, `.package-lock.json`, `.yarn-state.yml`, `.pnpm/lock.yaml` and so on).

At the moment, Vitest ignores the [test.cache.dir](/config/cache) or [cacheDir](https://vite.dev/config/shared-options#cachedir) options completely and creates a separate folder.

## experimental.openTelemetry <Version type="experimental">4.0.11</Version> {#experimental-opentelemetry}

::: tip FEEDBACK
Please leave feedback regarding this feature in a [GitHub Discussion](https://github.com/vitest-dev/vitest/discussions/9222).
:::

- **Type:**

```ts
interface OpenTelemetryOptions {
  enabled: boolean
  /**
   * A path to a file that exposes an OpenTelemetry SDK for Node.js.
   */
  sdkPath?: string
  /**
   * A path to a file that exposes an OpenTelemetry SDK for the browser.
   */
  browserSdkPath?: string
}
```

- **Default:** `{ enabled: false }`

This option controls [OpenTelemetry](https://opentelemetry.io/) support. Vitest imports the SDK file in the main thread and before every test file, if `enabled` is set to `true`.

::: danger PERFORMANCE CONCERNS
OpenTelemetry may significantly impact Vitest performance; enable it only for local debugging.
:::

You can use a [custom service](/guide/open-telemetry) together with Vitest to pinpoint which tests or files are slowing down your test suite.

For browser mode, see the [Browser Mode](/guide/open-telemetry#browser-mode) section of the OpenTelemetry guide.

An `sdkPath` is resolved relative to the [`root`](/config/root) of the project and should point to a module that exposes a started SDK instance as a default export. For example:

::: code-group
```js [otel.js]
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { NodeSDK } from '@opentelemetry/sdk-node'

const sdk = new NodeSDK({
  serviceName: 'vitest',
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
})

sdk.start()
export default sdk
```
```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      openTelemetry: {
        enabled: true,
        sdkPath: './otel.js',
      },
    },
  },
})
```
:::

::: warning
It's important that Node can process `sdkPath` content because it is not transformed by Vitest. See [the guide](/guide/open-telemetry) on how to work with OpenTelemetry inside of Vitest.
:::

## experimental.importDurations <Version type="experimental">4.1.0</Version> {#experimental-importdurations}

::: tip FEEDBACK
Please leave feedback regarding this feature in a [GitHub Discussion](https://github.com/vitest-dev/vitest/discussions/9224).
:::

- **Type:**

```ts
interface ImportDurationsOptions {
  /**
   * When to print import breakdown to CLI terminal.
   * - false: Never print (default)
   * - true: Always print
   * - 'on-warn': Print only when any import exceeds warn threshold
   */
  print?: boolean | 'on-warn'
  /**
   * Fail the test run if any import exceeds the danger threshold.
   * When enabled and threshold exceeded, breakdown is always printed.
   * @default false
   */
  failOnDanger?: boolean
  /**
   * Maximum number of imports to collect and display.
   */
  limit?: number
  /**
   * Duration thresholds in milliseconds for coloring and warnings.
   */
  thresholds?: {
    /** Threshold for yellow/warning color. @default 100 */
    warn?: number
    /** Threshold for red/danger color and failOnDanger. @default 500 */
    danger?: number
  }
}
```

- **Default:** `{ print: false, failOnDanger: false, limit: 0, thresholds: { warn: 100, danger: 500 } }` (`limit` is 10 if `print` or UI is enabled)

Configure import duration collection and display.

The `print` option controls CLI terminal output. The `limit` option controls how many imports to collect and display. [Vitest UI](/guide/ui#import-breakdown) can always toggle the breakdown display regardless of the `print` setting.

- Self: the time it took to import the module, excluding static imports;
- Total: the time it took to import the module, including static imports. Note that this does not include `transform` time of the current module.

<img alt="An example of import breakdown in the terminal" src="/reporter-import-breakdown.png" img-dark />
<img alt="An example of import breakdown in the terminal" src="/reporter-import-breakdown-light.png" img-light />

Note that if the file path is too long, Vitest will truncate it at the start until it fits 45 character limit.

### experimental.importDurations.print {#experimental-importdurationsprint}

- **Type:** `boolean | 'on-warn'`
- **Default:** `false`

Controls when to print import breakdown to CLI terminal after tests finish. This only works with [`default`](/guide/reporters#default), [`verbose`](/guide/reporters#verbose), or [`tree`](/guide/reporters#tree) reporters.

- `false`: Never print breakdown
- `true`: Always print breakdown
- `'on-warn'`: Print only when any import exceeds the `thresholds.warn` value

### experimental.importDurations.failOnDanger {#experimental-importdurationsfailondanger}

- **Type:** `boolean`
- **Default:** `false`

Fail the test run if any import exceeds the `thresholds.danger` value. When enabled and the threshold is exceeded, the breakdown is always printed regardless of the `print` setting.

This is useful for enforcing import performance budgets in CI:

```bash
vitest --experimental.importDurations.failOnDanger
```

### experimental.importDurations.limit {#experimental-importdurationslimit}

- **Type:** `number`
- **Default:** `0` (or `10` if `print`, `failOnDanger`, or UI is enabled)

Maximum number of imports to collect and display in CLI output, [Vitest UI](/guide/ui#import-breakdown), and third-party reporters.

### experimental.importDurations.thresholds {#experimental-importdurationsthresholds}

- **Type:** `{ warn?: number; danger?: number }`
- **Default:** `{ warn: 100, danger: 500 }`

Duration thresholds in milliseconds for coloring and warnings:

- `warn`: Threshold for yellow/warning color (default: 100ms)
- `danger`: Threshold for red/danger color and `failOnDanger` (default: 500ms)

::: info
[Vitest UI](/guide/ui#import-breakdown) shows a breakdown of imports automatically if at least one file took longer than the `danger` threshold to load.
:::

## experimental.viteModuleRunner <Version type="experimental">4.1.0</Version> {#experimental-vitemodulerunner}

- **Type:** `boolean`
- **Default:** `true`

Controls whether Vitest uses Vite's [module runner](https://vite.dev/guide/api-environment-runtimes#modulerunner) to run the code or fallback to the native `import`.

If this option is defined in the root config, all [projects](/guide/projects) will inherit it automatically.

Consider disabling the module runner if you are running tests in the same environment as your code (server backend or simple scripts, for example). However, we still recommend running `jsdom`/`happy-dom` tests with Vite's module runner or in [the browser](/guide/browser/) since it doesn't require any additional configuration.

Disabling this flag will disable _all_ file transforms:

- test files and your source code are not processed by Vite
- your global setup files are not processed
- your custom runner/pool/environment files are not processed
- your config file is still processed by Vite (this happens before Vitest knows the `viteModuleRunner` flag)

::: warning
At the moment, Vitest still requires Vite for certain functionality like the module graph or watch mode.

Also note that this option only works with `forks` or `threads` [pools](/config/pool).
:::

### Module Runner

By default, Vitest runs tests in a very permissive module runner sandbox powered by Vite's [Environment API](https://vite.dev/guide/api-environment.html#environment-api). Every file is categorized as either an "inline" module or an "external" module.

Module runner runs all "inlined" modules. It provides `import.meta.env`, `require`, `__dirname`, `__filename`, static `import`, and has its own module resolution mechanism. This makes it very easy to run code when you don't want to configure the environment and just need to test that the bare JavaScript logic you wrote works as intended.

All "external" modules run in native mode, meaning they are executed outside of the module runner sandbox. If you are running tests in Node.js, these files are imported with the native `import` keyword and processed by Node.js directly.

While running JSDOM/happy-dom tests in a permissive fake environment might be justified, running Node.js tests in a non-Node.js environment can hide and silence potential errors you may encounter in production, especially if your code doesn't require any additional transformations provided by Vite plugins.

### Known Limitations

Some Vitest features rely on files being transformed. Vitest uses synchronous [Node.js Loaders API](https://nodejs.org/api/module.html#customization-hooks) to transform test files and setup files to support these features:

- [`import.meta.vitest`](/guide/in-source)
- [`vi.mock`](/api/vi#vi-mock)
- [`vi.hoisted`](/api/vi#vi-hoisted)

::: warning
This means that Vitest requires at least Node 22.15 for those features to work. At the moment, they also do not work in Deno or Bun.

Vitest will only detect `vi.mock` and `vi.hoisted` inside of test files, they will not be hoisted inside imported modules.
:::

This could affect performance because Vitest needs to read the file and process it. If you do not use these features, you can disable the transforms by setting `experimental.nodeLoader` to `false`. Vitest only reads test files and setup files while looking for `vi.mock` or `vi.hoisted`. Using these in other files won't hoist them to the top of the file and can lead to unexpected behavior.

Some features will not work due to the nature of `viteModuleRunner`, including:

- no `import.meta.env`: `import.meta.env` is a Vite feature, use `process.env` instead
- no `plugins`: plugins are not applied because there is no transformation phase, use [customization hooks](https://nodejs.org/api/module.html#customization-hooks) via [`execArgv`](/config/execargv) instead
- no `alias`: aliases are not applied because there is no transformation phase
- `istanbul` coverage provider doesn't work because there is no transformation phase, use `v8` instead

::: warning Coverage Support
At the momemnt Vitest supports coverage via `v8` provider as long as files can be transformed into JavaScript. To transform TypeScript, Vitest uses [`module.stripTypeScriptTypes`](https://nodejs.org/api/module.html#modulestriptypescripttypescode-options) which is available in Node.js since v22.13. If you are using a custom [module loader](https://nodejs.org/api/module.html#customization-hooks), Vitest is not able to reuse it to transform files for analysis.
:::

With regards to mocking, it is also important to point out that ES modules do not support property override. This means that code like this won't work anymore:

```ts
import * as fs from 'node:fs'
import { vi } from 'vitest'

vi.spyOn(fs, 'readFileSync').mockImplementation(() => '42') // ❌
```

However, Vitest supports auto-spying on modules without overriding their implementation. When `vi.mock` is called with a `spy: true` argument, the module is mocked in a way that preserves original implementations, but all exported functions are wrapped in a `vi.fn()` spy:

```ts
import * as fs from 'node:fs'
import { vi } from 'vitest'

vi.mock('node:fs', { spy: true })

fs.readFileSync.mockImplementation(() => '42') // ✅
```

Factory mocking is implemented using a top-level await. This means that mocked modules cannot be loaded with `require()` in your source code:

```ts
vi.mock('node:fs', async (importOriginal) => {
  return {
    ...await importOriginal(),
    readFileSync: vi.fn(),
  }
})

const fs = require('node:fs') // throws an error
```

This limitation exists because factories can be asynchronous. This should not be a problem because Vitest doesn't mock builtin modules inside `node_modules`, which is simillar to how Vitest works by default.

### TypeScript

If you are using Node.js 22.18/23.6 or higher, TypeScript will be [transformed natively](https://nodejs.org/en/learn/typescript/run-natively) by Node.js.

::: warning TypeScript with Node.js 22.6-22.18
If you are using Node.js version between 22.6 and 22.18, you can also enable native TypeScript support via `--experimental-strip-types` flag:

```shell
NODE_OPTIONS="--experimental-strip-types" vitest
```

If you are using TypeScript and Node.js version lower than 22.6, then you will need to either:

- build your test files and source code and run those files directly
- import a [custom loader](https://nodejs.org/api/module.html#customization-hooks) via `execArgv` flag

```ts
import { defineConfig } from 'vitest/config'

const tsxApi = import.meta.resolve('tsx/esm/api')

export default defineConfig({
  test: {
    execArgv: [
      `--import=data:text/javascript,import * as tsx from "${tsxApi}";tsx.register()`,
    ],
    experimental: {
      viteModuleRunner: false,
    },
  },
})
```

If you are running tests in Deno, TypeScript files are processed by the runtime without any additional configurations.
:::

## experimental.nodeLoader <Version type="experimental">4.1.0</Version> {#experimental-nodeloader}

- **Type:** `boolean`
- **Default:** `true`

If module runner is disabled, Vitest uses a native [Node.js module loader](https://nodejs.org/api/module.html#customization-hooks) to transform files to support `import.meta.vitest`, `vi.mock` and `vi.hoisted`.

If you don't use these features, you can disable this to improve performance.
