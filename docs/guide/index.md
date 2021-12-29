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

In a project where Vitest is installed, you can use the `vitest` binary in your npm scripts, or run it directly with `npx vitest`. Here are the default npm scripts in a scaffolded Vitest project:

<!-- prettier-ignore -->
```json5
{
  "scripts": {
    "test": "vitest",
    "coverage": "vitest --coverage"
  }
}
```

To run tests once without watching for file changes, use `vitest run`.
You can specify additional CLI options like `--port` or `--https`. For a full list of CLI options, run `npx vitest --help` in your project.

### CLI Commands

### `vitest watch`

Run all test suites but watch for changes and rerun tests when they change. Same as calling `vitest` without a command. In CI environments this command will fallback to `vitest run`

### `vitest run`

Perform a single run without watch mode.

### `vitest dev`

Run vitest in development mode.

### CLI Options

| Options       |               |
| ------------- | ------------- |
| `-v, --version` | Display version number |
| `-r, --root <path>` | Define the project root |
| `-c, --config <path>` | Path to config file |
| `-u, --update` | Update snapshots |
| `-w, --watch` | Watch mode |
| `-o, --open` | Open UI (default: false) |
| `-t, --testNamePattern <pattern>` | Run tests with names matching the pattern |
| `--api` | Listen to port and serve API |
| `--threads` | Enable Threads (default: true) |
| `--silent` | Silent console output from tests |
| `--reporter <name>` | Select reporter: `default`, `verbose`, or `dot` |
| `--coverage` | Use c8 for coverage |
| `--run` | Do not watch |
| `--global` | Inject APIs globally |
| `--dom` | Mock browser api with happy-dom |
| `--findRelatedTests <filepath>` | Run only tests that import specified file |
| `--environment <env>` | Runner environment (default: node) |
| `--passWithNoTests` | Pass when no tests found |
| `-h, --help` | Display available CLI options |

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
