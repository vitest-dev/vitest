---
title: Workspace | Guide
---

# Workspace

::: tip Sample Project

[GitHub](https://github.com/vitest-dev/vitest/tree/main/examples/workspace) - [Play Online](https://stackblitz.com/fork/github/vitest-dev/vitest/tree/main/examples/workspace?initialPath=__vitest__/)

:::

Vitest provides built-in support for monorepos through a workspace configuration file. You can create a workspace to define your project's setups.

## Defining a Workspace

A workspace must include a `vitest.workspace` or `vitest.projects` file in its root directory (located in the same folder as your root configuration file, if applicable). Vitest supports `ts`, `js`, and `json` extensions for this file.

::: tip NAMING
Please note that this feature is named `workspace`, not `workspaces` (without an "s" at the end).
:::

Workspace configuration file must have a default export with a list of files or glob patterns referencing your projects. For example, if you have a folder named `packages` that contains your projects, you can define a workspace with this config file:

:::code-group
```ts [vitest.workspace.ts]
export default [
  'packages/*'
]
```
:::

Vitest will treat every folder in `packages` as a separate project even if it doesn't have a config file inside. Since Vitest 2.1, if this glob pattern matches any file it will be considered a Vitest config even if it doesn't have a `vitest` in its name.

::: warning
Vitest does not treat the root `vitest.config` file as a workspace project unless it is explicitly specified in the workspace configuration. Consequently, the root configuration will only influence global options such as `reporters` and `coverage`.
:::

You can also reference projects with their config files:

:::code-group
```ts [vitest.workspace.ts]
export default [
  'packages/*/vitest.config.{e2e,unit}.ts'
]
```
:::

This pattern will only include projects with a `vitest.config` file that contains `e2e` or `unit` before the extension.

You can also define projects using inline configuration. The workspace file supports both syntaxes simultaneously.

:::code-group
```ts [vitest.workspace.ts]
import { defineWorkspace } from 'vitest/config'

// defineWorkspace provides a nice type hinting DX
export default defineWorkspace([
  // matches every folder and file inside the `packages` folder
  'packages/*',
  {
    // add "extends" to merge two configs together
    extends: './vite.config.js',
    test: {
      include: ['tests/**/*.{browser}.test.{ts,js}'],
      // it is recommended to define a name when using inline configs
      name: 'happy-dom',
      environment: 'happy-dom',
    }
  },
  {
    test: {
      include: ['tests/**/*.{node}.test.{ts,js}'],
      name: 'node',
      environment: 'node',
    }
  }
])
```
:::

::: warning
All projects must have unique names; otherwise, Vitest will throw an error. If a name is not provided in the inline configuration, Vitest will assign a number. For project configurations defined with glob syntax, Vitest will default to using the "name" property in the nearest `package.json` file or the folder name if no such file exists.
:::

If you do not use inline configurations, you can create a small JSON file in your root directory:

:::code-group
```json [vitest.workspace.json]
[
  "packages/*"
]
```
:::

Workspace projects do not support all configuration properties. For better type safety, use the `defineProject` method instead of `defineConfig` within project configuration files:

:::code-group
```ts [packages/a/vitest.config.ts] twoslash
// @errors: 2769
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    environment: 'jsdom',
    // "reporters" is not supported in a project config,
    // so it will show an error
    reporters: ['json']
  }
})
```
:::

## Running tests

To run tests inside the workspace, define a script in your root `package.json`:

```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

Now tests can be run using your package manager:

::: code-group
```bash [npm]
npm run test
```
```bash [yarn]
yarn test
```
```bash [pnpm]
pnpm run test
```
```bash [bun]
bun test
```
:::

If you need to run tests only inside a single project, use the `--project` CLI option:

::: code-group
```bash [npm]
npm run test --project e2e
```
```bash [yarn]
yarn test --project e2e
```
```bash [pnpm]
pnpm run test --project e2e
```
```bash [bun]
bun test --project e2e
```
:::

::: tip
CLI option `--project` can be used multiple times to filter out several projects:

::: code-group
```bash [npm]
npm run test --project e2e --project unit
```
```bash [yarn]
yarn test --project e2e --project unit
```
```bash [pnpm]
pnpm run test --project e2e --project unit
```
```bash [bun]
bun test --project e2e --project unit
```
:::

## Configuration

None of the configuration options are inherited from the root-level config file. You can create a shared config file and merge it with the project config yourself:

::: code-group
```ts [packages/a/vitest.config.ts]
import { defineProject, mergeConfig } from 'vitest/config'
import configShared from '../vitest.shared.js'

export default mergeConfig(
  configShared,
  defineProject({
    test: {
      environment: 'jsdom',
    }
  })
)
```
:::

At the `defineWorkspace` level, you can use the `extends` option to inherit from your root-level configuration. All options will be merged.

::: code-group
```ts [vitest.workspace.ts]
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['**/*.unit.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'integration',
      include: ['**/*.integration.test.ts'],
    },
  },
])
```
:::

Some of the configuration options are not allowed in a project config. Most notably:

- `coverage`: coverage is done for the whole workspace
- `reporters`: only root-level reporters can be supported
- `resolveSnapshotPath`: only root-level resolver is respected
- all other options that don't affect test runners

::: tip
All configuration options that are not supported inside a project configuration are marked with a <NonProjectOption /> sign in the ["Config"](/config/) guide.
:::
