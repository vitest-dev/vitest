# Getting Started

<DevelopmentWarning/>

## Overview

Vitest is a blazing fast unit test framework powered by Vite.

You can learn more about the rationale behind the project in the [Why Vite](./why) section.

## Trying Vitest Online

You can try Vitest online on [StackBlitz](https://stackblitz.com/fork/node-8hobg2?file=test%2Fbasic.test.ts&view=editor). It runs Vitest directly in the browser, and it is almost identical to the local setup but doesn't require installing anything on your machine.

## Adding Vitest to your Project

```bash
$ npm install -D vitest
```

:::tip
Vitest requires Vite >=v2.7 and Node >=v14
:::

## Configuring Vitest

One of the main advantages of Vitest is its unified configuration with Vite. If present, `vitest` will read your root `vite.config.ts` to match with the plugins and setup as your Vite app. For example, your Vite [resolve.alias](https://vitejs.dev/config/#resolve-alias) and [plugins](https://vitejs.dev/guide/using-plugins.html) configuration will work out-of-the-box. If you want a different configuration during testing, you can:

- Create `vitest.config.ts`, which will have the higher priority
- Pass `--config` option to CLI, e.g. `vitest --config ./path/to/vitest.config.ts`
- Use `process.env.VITEST` to conditionally apply different configuration in `vite.config.ts`

To configure `vitest` itself, add `test` property in your Vite config. You'll also need to add a reference to Vitest types using a [triple slash command](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html#-reference-types-) at the top of your config file.

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    // ...
  },
})
```

See the list of config options in the [Config Reference](../config/)

## Command Line Interface

In a project where Vitest is installed, you can use the `vitest` binary in your npm scripts, or run it directly with `npx vitest`. Here is the default npm scripts in a scaffolded Vite project:

<!-- prettier-ignore -->
```json5
{
  "scripts": {
    "test": "vitest",
    "coverage": "vitest --coverage"
  }
}

```

You can specify additional CLI options like `--port` or `--https`.

### All avaible commands

- [`run`](#run)
- [`watch`](#watch)
- [`dev`](#dev)

#### run

Run all test suites.

#### watch

run all test suites but watch for changes and rerun tests when they change.

#### dev

Run vites in development mode.

### All available options


- [`--api`](#api)
- [`--threads`](#threads)
- [`--port`](#port)
- [`--reporter <name>`](#reporter)
- [`--coverage`](#coverage)
- [`--run`](#run)
- [`--global`](#global)
- [`--dom`](#--dom)
- [`--environment`](#environment)
- [`--passWithNoTests`](#passWithNoTests)
- [`--help`](#help)
- [`--version`](#version)
- [`--root`](#root)
- [`--config`](#config)
- [`--update`](#update)
- [`--watch`](#watch)
- [`--open`](#open)


#### `--api`

listen to port and serve API

#### `--threads`

enabled threads (default: true)

#### `--port`

silent console.log output from tests.

#### `--reporter <name>`

reporter.

#### `--coverage`

use c8 for coverage.

#### `--run`

do not watch.

#### `--global`

inject apis globally.

#### `--dom`

mock browser api with happy-dom.

#### `--environment`

runner environment (default: node)

#### `--passWithNoTests`

pass when no tests found.

#### `--help`

display this message.

#### `--version`

display version number.

#### `--root`

use this `--root <path>`  for the project


#### `--config`

use `--config <path>  ` to specify the path to the test file you want to run

#### `--update`

update snapshot

#### `--watch`

Run tests in watch mode

#### `--open`

open Vitest UI




## Examples

- [Unit Testing](https://github.com/vitest-dev/vitest/tree/main/test/core)
- [Vue Component Testing](https://github.com/vitest-dev/vitest/tree/main/test/vue)
- [React Component Testing](https://github.com/vitest-dev/vitest/tree/main/test/react)
- [Svelte Component Testing](https://github.com/vitest-dev/vitest/tree/main/test/svelte)
- [Lit Component Testing](https://github.com/vitest-dev/vitest/tree/main/test/lit)
- [Vitesse Component Testing](https://github.com/vitest-dev/vitest/tree/main/test/vitesse)

## Projects using Vitest

- [unocss](https://github.com/antfu/unocss)
- [unplugin-auto-import](https://github.com/antfu/unplugin-auto-import)
- [unplugin-vue-components](https://github.com/antfu/unplugin-vue-components)
- [vitesse-lite](https://github.com/antfu/vitesse-lite)

## Using Unreleased Commits

If you can't wait for a new release to test the latest features, you will need to clone the [vitest repo](https://github.com/vitest-dev/vitest) to your local machine and then build and link it yourself ([pnpm](https://pnpm.io/) is required):

```bash
git clone https://github.com/vitest-dev/vitest.git
cd vitest
pnpm install
cd packages/vitest
pnpm run build
pnpm link --global # you can use your preferred package manager for this step
```

Then go to the project where you are using Vitest and run `pnpm link --global vitest` (or the package manager that you used to link `vitest` globally).

## Community

If you have questions or need help, reach out to the community at [Discord](https://chat.vitest.dev) and [GitHub Discussions](https://github.com/vitest-dev/vitest/discussions).
