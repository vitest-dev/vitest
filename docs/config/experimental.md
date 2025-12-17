---
title: experimental | Config
outline: deep
---

# experimental

## experimental.fsModuleCache <Version type="experimental">4.0.11</Version> {#experimental-fsmodulecache}

::: tip FEEDBACK
Please, leave feedback regarding this feature in a [GitHub Discussion](https://github.com/vitest-dev/vitest/discussions/9221).
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

Vitest creates persistent file hash based on file content, its id, vite's environment configuration and coverage status. Vitest tries to use as much information it has about the configuration, but it is still incomplete. At the moment, it is not possible to track your plugin options because there is no standard interface for it.

If you have a plugin that relies on things outside the file content or the public configuration (like reading another file or a folder), it's possible that the cache will get stale. To workaround that, you can define a [cache key generator](/api/advanced/plugin#definecachekeygenerator) to specify dynamic option or to opt-out of caching for that module:

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

On the other hand, if your plugin should not affect the cache key, you can opt-out by setting `api.vitest.experimental.ignoreFsModuleCache` to `true`:

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

Note that you can still define the cache key generator even the plugin opt-out of module caching.

## experimental.fsModuleCachePath <Version type="experimental">4.0.11</Version> {#experimental-fsmodulecachepath}

- **Type:** `string`
- **Default:** `'node_modules/.experimental-vitest-cache'`

Directory where the file system cache is located.

By default, Vitest will try to find the workspace root and store the cache inside the `node_modules` folder. The root is based on your package manager's lockfile (for example, `.package-lock.json`, `.yarn-state.yml`, `.pnpm/lock.yaml` and so on).

At the moment, Vitest ignores the [test.cache.dir](/config/cache) or [cacheDir](https://vite.dev/config/shared-options#cachedir) options completely and creates a separate folder.

## experimental.openTelemetry <Version type="experimental">4.0.11</Version> {#experimental-opentelemetry}

::: tip FEEDBACK
Please, leave feedback regarding this feature in a [GitHub Discussion](https://github.com/vitest-dev/vitest/discussions/9222).
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

## experimental.printImportBreakdown <Version type="experimental">4.0.15</Version> {#experimental-printimportbreakdown}

::: tip FEEDBACK
Please, leave feedback regarding this feature in a [GitHub Discussion](https://github.com/vitest-dev/vitest/discussions/9224).
:::

- **Type:** `boolean`
- **Default:** `false`

Show import duration breakdown after tests have finished running. This option only works with [`default`](/guide/reporters#default), [`verbose`](/guide/reporters#verbose), or [`tree`](/guide/reporters#tree) reporters.

- Self: the time it took to import the module, excluding static imports;
- Total: the time it took to import the module, including static imports. Note that this does not include `transform` time of the current module.

<img alt="An example of import breakdown in the terminal" src="/reporter-import-breakdown.png" />

Note that if the file path is too long, Vitest will truncate it at the start until it fits 45 character limit.

::: info
[Vitest UI](/guide/ui#import-breakdown) shows a breakdown of imports automatically if at least one file took longer than 500 milliseconds to load. You can manually set this option to `false` to disable this.
:::
