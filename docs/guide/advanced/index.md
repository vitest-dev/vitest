---
title: Advanced API
---

# Getting Started <Badge type="danger">advanced</Badge> {#getting-started}

::: warning
This guide lists advanced APIs to run tests via a Node.js script. If you just want to [run tests](/guide/), you probably don't need this. It is primarily used by library authors.
:::

You can import any method from the `vitest/node` entry-point.

## startVitest

```ts
function startVitest(
  cliFilters: string[] = [],
  options: CliOptions = {},
  viteOverrides?: ViteUserConfig,
  vitestOptions?: VitestOptions,
): Promise<Vitest>
```

You can start running Vitest tests using its Node API:

```js
import { startVitest } from 'vitest/node'

const vitest = await startVitest()

await vitest.close()
```

`startVitest` function returns [`Vitest`](/api/advanced/vitest) instance if tests can be started.

If watch mode is not enabled, Vitest will call `close` method automatically.

If watch mode is enabled and the terminal supports TTY, Vitest will register console shortcuts.

You can pass down a list of filters as a second argument. Vitest will run only tests that contain at least one of the passed-down strings in their file path.

Additionally, you can use the third argument to pass in CLI arguments, which will override any test config options. Alternatively, you can pass in the complete Vite config as the fourth argument, which will take precedence over any other user-defined options.

After running the tests, you can get the results from the [`state.getTestModules`](/api/advanced/test-module) API:

```ts
import type { TestModule } from 'vitest/node'

const vitest = await startVitest()

console.log(vitest.state.getTestModules()) // [TestModule]
```

::: tip
The ["Running Tests"](/guide/advanced/tests#startvitest) guide has a usage example.
:::

## createVitest

```ts
function createVitest(
  options: CliOptions,
  viteOverrides: ViteUserConfig = {},
  vitestOptions: VitestOptions = {},
): Promise<Vitest>
```

You can create Vitest instance by using `createVitest` function. It returns the same [`Vitest`](/api/advanced/vitest) instance as `startVitest`, but it doesn't start tests and doesn't validate installed packages.

```js
import { createVitest } from 'vitest/node'

const vitest = await createVitest('test', {
  watch: false,
})
```

::: tip
The ["Running Tests"](/guide/advanced/tests#createvitest) guide has a usage example.
:::

## resolveConfig

```ts
function resolveConfig(
  options: UserConfig = {},
  viteOverrides: ViteUserConfig = {},
  harness?: PluginHarness,
): Promise<ResolvedViteConfig>
```

This method resolves the config with custom parameters, without creating a Vite server. If no parameters are given, the `root` will be `process.cwd()`.

It returns the resolved Vite config. The fully resolved Vitest config, including every project, lives on its `test` property.

```ts
import { resolveConfig } from 'vitest/node'

const viteConfig = await resolveConfig({
  mode: 'custom',
  configFile: false,
  resolve: {
    conditions: ['custom']
  },
  test: {
    setupFiles: ['/my-setup-file.js'],
    pool: 'threads',
  },
})

viteConfig.test.pool // 'threads'
```

::: info
This is the same method Vitest uses internally to resolve the config before creating the server. If you pass the options down to `startVitest` or `createVitest`, Vitest resolves them again.

You can pass a shared [`PluginHarness`](#pluginharness) as the third argument to reuse a logger and package installer across calls.
:::

## parseCLI

```ts
function parseCLI(argv: string | string[], config: CliParseOptions = {}): {
  filter: string[]
  options: CliOptions
}
```

You can use this method to parse CLI arguments. It accepts a string (where arguments are split by a single space) or a strings array of CLI arguments in the same format that Vitest CLI uses. It returns a filter and `options` that you can later pass down to `createVitest` or `startVitest` methods.

```ts
import { parseCLI } from 'vitest/node'

const result = parseCLI('vitest ./files.ts --coverage --browser=chrome')

result.options
// {
//   coverage: { enabled: true },
//   browser: { name: 'chrome', enabled: true }
// }

result.filter
// ['./files.ts']
```

## createCLI

```ts
function createCLI(options?: CliParseOptions): CAC
```

Creates the Vitest command-line interface: a [`cac`](https://github.com/cacjs/cac) instance with all of Vitest's commands and options registered. [`parseCLI`](#parsecli) is built on top of it; use `createCLI` directly if you need the raw parser.

```ts
import { createCLI } from 'vitest/node'

const cli = createCLI()
```

## PluginHarness

```ts
class PluginHarness {
  vitest?: Vitest
  version: string
  logger: Logger
  packageInstaller: VitestPackageInstaller
  getVitest(): Vitest
}
```

A container that Vitest passes to its internal plugins while the config is being resolved, before a [`Vitest`](/api/advanced/vitest) instance exists. It holds the [`Logger`](#logger), the package installer and the resolved version, and exposes the `Vitest` instance via `getVitest()` once it has been created (calling it earlier throws).

This is an advanced, plugin-facing API. You rarely construct one directly, but you can pass a shared instance to [`resolveConfig`](#resolveconfig) to reuse a logger and package installer.

## Logger

```ts
class Logger {
  constructor(
    outputStream?: Writable,
    errorStream?: Writable,
  )
}
```

Vitest's terminal logger, exposed as [`vitest.logger`](/api/advanced/vitest). It handles formatted output, the error summary, the run banner and screen clearing. Construct one with custom `stdout`/`stderr` streams to capture or redirect Vitest's output when running it programmatically.

```ts
import { Logger } from 'vitest/node'

const logger = new Logger(process.stdout, process.stderr)
```
