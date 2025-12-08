---
title: experimental | Config
outline: deep
---

# experimental

## experimental.fsModuleCache <Version type="experimental">4.0.11</Version> {#experimental-fsmodulecache}

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

- **Type:**

```ts
interface OpenTelemetryOptions {
  enabled: boolean
  /**
   * A path to a file that exposes an OpenTelemetry SDK.
   */
  sdkPath?: string
}
```

- **Default:** `{ enabled: false }`

This option controls [OpenTelemetry](https://opentelemetry.io/) support. Vitest imports the SDK file in the main thread and before every test file, if `enabled` is set to `true`.

::: danger PERFORMANCE CONCERNS
OpenTelemetry may significantly impact Vitest performance; enable it only for local debugging.
:::

You can use a [custom service](/guide/open-telemetry) together with Vitest to pinpoint which tests or files are slowing down your test suite.

::: warning BROWSER SUPPORT
At the moment, Vitest does not start any spans when running in [the browser](/guide/browser/).
:::

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

## experimental.viteModuleRunner <Version type="experimental">4.0.16</Version> {#experimental-vitemodulerunner}

- **Type:** `boolean`
- **Default:** `true`

Controls whether Vitest uses Vite's [module runner](https://vite.dev/guide/api-environment-runtimes#modulerunner) to run the code or fallback to the native `import`.

If this option is defined in the root config, all [projects](/guide/projects) will inherit it automatically.

We recommend disabling the module runner if you are running tests in the same environment as your code (server backend or simple scripts, for example). However, we still recommend running `jsdom`/`happy-dom` tests with the module runner or in [the browser](/guide/browser/) as it doesn't require any additional configuration.

Disabling this flag will disable _all_ file transforms:

- test files and your source code are not processed by Vite
- your global setup files are not processed
- your custom runner/pool/environment files are not processed
- your config file is still processed by Vite's config resolution mechanism (this happens before Vitest knows the flag)

::: warning
At the moment, Vitest still requires Vite for certain functionality like the module graph or watch mode.
:::

### Module Runner

By default, Vitest runs tests in a very permissive module runner sandbox powered by Vite's [Environment API](https://vite.dev/guide/api-environment.html#environment-api). Every file is categorized as either an "inline" module or an "external" module.

Module runner runs all "inline" modules. It provides `import.meta.env`, `require`, `__dirname`, `__filename`, static `import`, and has its own module resolution mechanism. This makes it very easy to run code when you don't want to configure the environment and just need to test that the bare JavaScript logic you wrote works as intended.

All "external" modules run in native mode, meaning they are executed outside of the module runner sandbox. If you are running tests in Node.js, these files are imported with the native `import` keyword and processed by Node.js directly.

While running JSDOM/happy-dom tests in a permissive fake environment might be justified, running Node.js tests in a non-Node.js environment is counter-productive as it can hide and silence potential errors you may encounter in production, especially if your code doesn't require any additional transformations provided by Vite plugins.

### Limitations

Some Vitest features rely on files being transformed in some way. These feature do not work if Vitest doesn't use the module runner:

- no `import.meta.env` in Node: `import.meta.env` is a Vite feature, use `process.env` instead
- no `import.meta.vitest`: in-source testing requires injecting values to `import.meta` which is not supported by any environment without custom transforms
- no `vi.mock` support: mocking modules is not supported because it relies on code transformations
- no `plugins`: plugins are not applied because there is no transformation phase
- no `alias`: aliases are not applied because there is no transformation/resolution phase

::: warning Support is Coming
We are planning to support some of these features by using the [Node.js Loaders API](https://nodejs.org/api/module.html#customization-hooks) in the future.
:::

### TypeScript

If you are using Node.js 22.18/23.6 or higher, then TypeScript will be [transformed natively](https://nodejs.org/en/learn/typescript/run-natively) by Node.js.

::: warning TypeScript with Node.js 22.6-22.18
If you are using Node.js version between 22.6 and 22.18, you can also enable native TypeScript support via `--experimental-strip-types` flag:

```shell
NODE_OPTIONS="--experimental-strip-types" vitest
```

Note that Node.js will print an experimental warning for every test file; you can silence the warning by providing `--no-warnings` flag:

```shell
NODE_OPTIONS="--experimental-strip-types --no-warnings" vitest
```
:::

If you are using TypeScript and Node.js version lower than 22.6, then you will need to either:

- build your test files and source code and run those files directly
- import a [custom loader](https://nodejs.org/api/module.html#customization-hooks) via `execArgv` flag

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // TODO: validate
    execArgv: ['--require=tsx/esm'],
    experimental: {
      viteModuleRunner: false,
    },
  },
})
```

If you are running tests in Deno, TypeScript files are processed by the runtime without any additional configurations.
