---
title: Workspace | Guide
---

# Workspace

::: tip Sample Project

[GitHub](https://github.com/vitest-dev/vitest/tree/main/examples/workspace) - [Play Online](https://stackblitz.com/fork/github/vitest-dev/vitest/tree/main/examples/workspace?initialPath=__vitest__/)

:::

Vitest provides a way to define multiple project configurations within a single Vitest process. This feature is particularly useful for monorepo setups but can also be used to run tests with different configurations, such as `resolve.alias`, `plugins`, or `test.browser` and more.

## Defining a Workspace

A workspace must include a `vitest.workspace` or `vitest.projects` file in its root directory (located in the same folder as your root configuration file or working directory if it doesn't exist). Note that `projects` is just an alias and does not change the behavior or semantics of this feature. Vitest supports `ts`, `js`, and `json` extensions for this file.

Since Vitest 3, you can also define a workspace in the root config. In this case, Vitest will ignore the `vitest.workspace` file in the root, if one exists.

::: tip NAMING
Please note that this feature is named `workspace`, not `workspaces` (without an "s" at the end).
:::

A workspace is a list of inlined configs, files, or glob patterns referencing your projects. For example, if you have a folder named `packages` that contains your projects, you can either create a workspace file or define an array in the root config:

:::code-group
```ts [vitest.workspace.ts]
export default [
  'packages/*'
]
```
```ts [vitest.config.ts <Version>3.0.0</Version>]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    workspace: ['packages/*'],
  },
})
```
:::

Vitest will treat every folder in `packages` as a separate project even if it doesn't have a config file inside. If this glob pattern matches any file it will be considered a Vitest config even if it doesn't have a `vitest` in its name.

::: warning
Vitest does not treat the root `vitest.config` file as a workspace project unless it is explicitly specified in the workspace configuration. Consequently, the root configuration will only influence global options such as `reporters` and `coverage`. Note that Vitest will always run certain plugin hooks, like `apply`, `config`, `configResolved` or `configureServer`, specified in the root config file. Vitest also uses the same plugins to execute global setups, workspace files and custom coverage provider.
:::

You can also reference projects with their config files:

:::code-group
```ts [vitest.workspace.ts]
export default [
  'packages/*/vitest.config.{e2e,unit}.ts'
]
```
```ts [vitest.config.ts <Version>3.0.0</Version>]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    workspace: ['packages/*/vitest.config.{e2e,unit}.ts'],
  },
})
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
```ts [vitest.config.ts <Version>3.0.0</Version>]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    workspace: [
      // matches every folder and file inside the `packages` folder
      'packages/*',
      {
        // add "extends: true" to inherit the options from the root config
        extends: true,
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
    ]
  }
})
```
:::

::: warning
All projects must have unique names; otherwise, Vitest will throw an error. If a name is not provided in the inline configuration, Vitest will assign a number. For project configurations defined with glob syntax, Vitest will default to using the "name" property in the nearest `package.json` file or, if none exists, the folder name.
:::

If you do not use inline configurations, you can create a small JSON file in your root directory or just specify it in the root config:

:::code-group
```json [vitest.workspace.json]
[
  "packages/*"
]
```
```ts [vitest.config.ts <Version>3.0.0</Version>]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    workspace: ['packages/*'],
  },
})
```
:::

Workspace projects do not support all configuration properties. For better type safety, use the `defineProject` method instead of `defineConfig` within project configuration files:

```ts twoslash [packages/a/vitest.config.ts]
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

## Running tests

To run tests inside the workspace, define a script in your root `package.json`:

```json [package.json]
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

None of the configuration options are inherited from the root-level config file, even if the workspace is defined inside that config and not in a separate `vitest.workspace` file. You can create a shared config file and merge it with the project config yourself:

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

Additionally, at the `defineWorkspace` level, you can use the `extends` option to inherit from your root-level configuration. All options will be merged.

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
```ts [vitest.config.ts <Version>3.0.0</Version>]
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    pool: 'threads',
    workspace: [
      {
        // will inherit options from this config like plugins and pool
        extends: true,
        test: {
          name: 'unit',
          include: ['**/*.unit.test.ts'],
        },
      },
      {
        // won't inherit any options from this config
        // this is the default behaviour
        extends: false,
        test: {
          name: 'integration',
          include: ['**/*.integration.test.ts'],
        },
      },
    ],
  },
})
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
