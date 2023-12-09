---
title: Workspace | Guide
---

# Workspace

Vitest provides built-in support for monorepos through a workspace configuration file. You can create a workspace to define your project's setups.

## Defining a Workspace

A workspace should have a `vitest.workspace` or `vitest.projects` file in its root (in the same folder as your config file if you have one). Vitest supports `ts`/`js`/`json` extensions for this file.

Workspace configuration file should have a default export with a list of files or glob patterns referencing your projects. For example, if you have a folder with your projects named `packages`, you can define a workspace with this config file:

:::code-group
```ts [vitest.workspace.ts]
export default [
  'packages/*'
]
```
:::

Vitest will consider every folder in `packages` as a separate project even if it doesn't have a config file inside.

::: warning
Vitest will not consider the root config as a workspace project (so it will not run tests specified in `include`) unless it is specified in this config.
:::

You can also reference projects with their config files:

:::code-group
```ts [vitest.workspace.ts]
export default [
  'packages/*/vitest.config.{e2e,unit}.ts'
]
```
:::

This pattern will only include projects with `vitest.config` file that includes `e2e` and `unit` before the extension.

::: warning
If you are referencing filenames with glob pattern, make sure your config file starts with `vite.config` or `vitest.config`. Otherwise Vitest will skip it.
:::

You can also define projects with inline config. Workspace file supports using both syntaxes at the same time.

:::code-group
```ts [vitest.workspace.ts]
import { defineWorkspace } from 'vitest/config'

// defineWorkspace provides a nice type hinting DX
export default defineWorkspace([
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
All projects should have unique names. Otherwise, Vitest will throw an error. If you do not provide a name inside the inline config, Vitest will assign a number. If you don't provide a name inside a project config defined with glob syntax, Vitest will use the directory name by default.
:::

If you don't rely on inline configs, you can just create a small json file in your root directory:

:::code-group
```json [vitest.workspace.json]
[
  "packages/*"
]
```
:::

Workspace projects don't support all configuration properties. For better type safety, use `defineProject` instead of `defineConfig` method inside project configuration files:

:::code-group
```ts [packages/a/vitest.config.ts]
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

```bash
npm run test --project e2e
```

::: tip
CLI option `--project` can be used multiple times to filter out several projects:

```bash
npm run test --project e2e --project unit
```
:::

## Configuration

None of the configuration options are inherited from the root-level config file. You can create a shared config file and merge it with the project config yourself:

:::code-group
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

Also, some of the configuration options are not allowed in a project config. Most notably:

- `coverage`: coverage is done for the whole workspace
- `reporters`: only root-level reporters can be supported
- `resolveSnapshotPath`: only root-level resolver is respected
- all other options that don't affect test runners

::: tip
All configuration options that are not supported inside a project config have <NonProjectOption /> sign next them in ["Config"](/config/) page.
:::

## Coverage

Coverage for workspace projects works out of the box. But if you have [`all`](/config/#coverage-all) option enabled and use non-conventional extensions in some of your projects, you will need to have a plugin that handles this extension in your root configuration file.

For example, if you have a package that uses Vue files and it has its own config file, but some of the files are not imported in your tests, coverage will fail trying to analyze the usage of unused files, because it relies on the root configuration rather than project configuration.
