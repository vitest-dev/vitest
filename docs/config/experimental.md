---
title: experimental | Config
outline: deep
---

# experimental

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

::: tip FEEDBACK
Please leave feedback regarding this feature in a [GitHub Discussion](https://github.com/vitest-dev/vitest/discussions/9501).
:::

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
- `vi.resetModules()`: there is no API to invalidate ES modules from the module cache

::: warning Coverage Support
At the moment Vitest supports coverage via `v8` provider as long as files can be transformed into JavaScript. To transform TypeScript, Vitest uses [`module.stripTypeScriptTypes`](https://nodejs.org/api/module.html#modulestriptypescripttypescode-options) which is available in Node.js since v22.13. If you are using a custom [module loader](https://nodejs.org/api/module.html#customization-hooks), Vitest is not able to reuse it to transform files for analysis.
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

This limitation exists because factories can be asynchronous. This should not be a problem because Vitest doesn't mock builtin modules inside `node_modules`, which is similar to how Vitest works by default.

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

## experimental.vcsProvider <Version type="experimental">4.1.1</Version> {#experimental-vcsprovider}

- **Type:** `VCSProvider | string`

```ts
interface VCSProvider {
  findChangedFiles(options: VCSProviderOptions): Promise<string[]>
}

interface VCSProviderOptions {
  root: string
  changedSince?: string | boolean
}
```

- **Default:** `'git'`

Custom provider for detecting changed files. Used with the [`--changed`](/guide/cli#changed) flag to determine which files have been modified.

By default, Vitest uses Git to detect changed files. You can provide a custom implementation of the `VCSProvider` interface to use a different version control system:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      vcsProvider: {
        async findChangedFiles({ root, changedSince }) {
          // return paths of changed files
          return []
        },
      },
    },
  },
})
```

You can also pass a string path to a module with a default export that implements the `VCSProvider` interface:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      vcsProvider: './my-vcs-provider.js',
    },
  },
})
```

```js [my-vcs-provider.js]
export default {
  async findChangedFiles({ root, changedSince }) {
    // return paths of changed files
    return []
  },
}
```

## experimental.nodeLoader <Version type="experimental">4.1.0</Version> {#experimental-nodeloader}

- **Type:** `boolean`
- **Default:** `true`

If module runner is disabled, Vitest uses a native [Node.js module loader](https://nodejs.org/api/module.html#customization-hooks) to transform files to support `import.meta.vitest`, `vi.mock` and `vi.hoisted`.

If you don't use these features, you can disable this to improve performance.

## experimental.preParse <Version type="experimental">4.1.3</Version> {#experimental-preparse}

- **Type:** `boolean`
- **Default:** `false`

Parses test specifications before running them. This applies the [`.only`](/api/test#test-only) modifier, the [`-t`](/config/testnamepattern) test name pattern, [`--tags-filter`](/guide/test-tags#syntax), [test lines](/api/advanced/test-specification#testlines), and [test IDs](/api/advanced/test-specification#testids) across all files without executing them. For example, if only a single test is marked with `.only`, Vitest will skip all other tests in all files.

::: tip
This option is recommended when using [`.only`](/api/test#test-only), the [`-t`](/config/testnamepattern) flag, or [`--tags-filter`](/guide/test-tags#syntax).

Enabling it unconditionally may slow down your test runs due to the additional parsing step.
:::

::: warning
Pre-parsing uses static analysis (AST parsing) instead of executing your test files. This means that test names, tags, and modifiers (`.only`, `.skip`, `.todo`) must be statically analyzable. Dynamic test names (e.g., names stored in variables or returned from function calls) and non-literal tags will not be resolved correctly.

```ts
// ✅ works — static string literal
test('adds numbers', () => {})

// ✅ works — static tags
test('my test', { tags: ['unit'] }, () => {})

// ❌ won't match correctly — dynamic name
const name = getName()
test(name, () => {})

// ❌ won't match correctly — dynamic tags
const tags = getTags()
test('my test', { tags }, () => {})
```
:::

## experimental.diagnostics <Version type="experimental">5.0.0</Version> {#experimental-diagnostics}

- **Type:**

```ts
interface DiagnosticsOptions {
  /**
   * Hint when `isolate: true` spends a significant amount of time spawning
   * a fresh worker (and re-creating the environment) for every test file,
   * estimating how much `isolate: false` could save.
   * @default true
   */
  isolate?: boolean
  /**
   * Hint when re-creating a DOM environment for every test file dominates
   * the run and a `vm` pool would set it up once per worker.
   * @default true
   */
  environment?: boolean
  /**
   * Hint when test files repeatedly evaluate the same module graph
   * (typical for barrel-file imports) and `isolate: false` would
   * evaluate it once per worker.
   * @default true
   */
  import?: boolean
  /**
   * Hint when transforming modules dominates the run and
   * `fsModuleCache` would persist the results across runs.
   * @default true
   */
  transform?: boolean
}
```

- **Default:** `true`

Print performance hints after the run when the collected timings show that a configuration change would make the run significantly faster:

```
Environment  jsdom was created 40 times · 23.80s total, 79% of tracked time
             create it once per worker with pool: 'vmThreads' (keeps per-file isolation) or isolate: false (shares it across files)
             learn more: https://vitest.dev/guide/improving-performance#test-environments
```

Hints never suggest changing an option that was set explicitly: if the config defines `pool`, other pools are not suggested, and an explicitly configured `isolate` is never suggested to be disabled. Hints are also printed in CI. Set the option to `false` to disable all hints, or disable them individually.

### experimental.diagnostics.isolate {#experimental-diagnostics-isolate}

- **Type:** `boolean`
- **Default:** `true`

Hint when `isolate: true` spends a significant amount of time spawning a fresh worker (and re-creating the environment) for every test file, estimating how much `isolate: false` could save. Reused workers also keep evaluated modules alive, so files stop re-evaluating the module graph they share. Per-module evaluation times are only collected when [`experimental.importDurations`](#experimental-importdurations) is enabled; without it the estimate counts the worker startups alone and is reported as a lower bound ("at least").

### experimental.diagnostics.environment {#experimental-diagnostics-environment}

- **Type:** `boolean`
- **Default:** `true`

Hint when re-creating a DOM environment for every test file dominates the run and a `vm` pool would set it up once per worker.

### experimental.diagnostics.import {#experimental-diagnostics-import}

- **Type:** `boolean`
- **Default:** `true`

Hint when test files repeatedly evaluate the same module graph and `isolate: false` would evaluate it once per worker. This is typical for barrel-file imports: every test file imports a few symbols through an index file and evaluates the whole graph behind it. The duplication is measured from how often each module was served to the workers, so suites whose test files import mostly disjoint modules stay quiet: reusing workers would not reduce their import work.

```
Import  837 modules were evaluated 16740 times · 15.69s total, 64% of tracked time
        ~850ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
        learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

### experimental.diagnostics.transform {#experimental-diagnostics-transform}

- **Type:** `boolean`
- **Default:** `true`

Hint when transforming modules dominates the run. Without a persistent cache every `vitest run` transforms the whole module graph from scratch; [`fsModuleCache`](/config/fsmodulecache) stores the results on disk so repeated runs skip them. The hint estimates the time the next run would save. On CI the hint includes a note that the cache directory must be persisted between runs for the cache to take effect.
