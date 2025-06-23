---
title: Test Projects | Guide
---

# Test Projects

::: tip Sample Project

[GitHub](https://github.com/vitest-dev/vitest/tree/main/examples/projects) - [Play Online](https://stackblitz.com/fork/github/vitest-dev/vitest/tree/main/examples/projects?initialPath=__vitest__/)

:::

::: warning
This feature is also known as a `workspace`. The `workspace` is deprecated since 3.2 and replaced with the `projects` configuration. They are functionally the same.
:::

Vitest provides a way to define multiple project configurations within a single Vitest process. This feature is particularly useful for monorepo setups but can also be used to run tests with different configurations, such as `resolve.alias`, `plugins`, or `test.browser` and more.

## Defining Projects

You can define projects in your root [config](/config/):

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
})
```

Project configurations are inlined configs, files, or glob patterns referencing your projects. For example, if you have a folder named `packages` that contains your projects, you can define an array in your root Vitest config:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
})
```

Vitest will treat every folder in `packages` as a separate project even if it doesn't have a config file inside. If this glob pattern matches _any file_, it will be considered a Vitest config even if it doesn't have a `vitest` in its name or has an obscure file extension.

::: warning
Vitest does not treat the root `vitest.config` file as a project unless it is explicitly specified in the configuration. Consequently, the root configuration will only influence global options such as `reporters` and `coverage`. Note that Vitest will always run certain plugin hooks, like `apply`, `config`, `configResolved` or `configureServer`, specified in the root config file. Vitest also uses the same plugins to execute global setups and custom coverage provider.
:::

You can also reference projects with their config files:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.{e2e,unit}.ts'],
  },
})
```

This pattern will only include projects with a `vitest.config` file that contains `e2e` or `unit` before the extension.

You can also define projects using inline configuration. The configuration supports both syntaxes simultaneously.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
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
          // color of the name label can be changed
          name: { label: 'node', color: 'green' },
          environment: 'node',
        }
      }
    ]
  }
})
```

::: warning
All projects must have unique names; otherwise, Vitest will throw an error. If a name is not provided in the inline configuration, Vitest will assign a number. For project configurations defined with glob syntax, Vitest will default to using the "name" property in the nearest `package.json` file or, if none exists, the folder name.
:::

Projects do not support all configuration properties. For better type safety, use the `defineProject` method instead of `defineConfig` within project configuration files:

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

## Running Tests

To run tests, define a script in your root `package.json`:

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
bun run test
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
bun run test --project e2e
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
bun run test --project e2e --project unit
```
:::

## Configuration

None of the configuration options are inherited from the root-level config file. You can create a shared config file and merge it with the project config yourself:

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

Additionally, you can use the `extends` option to inherit from your root-level configuration. All options will be merged.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    pool: 'threads',
    projects: [
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

::: danger Unsupported Options
Some of the configuration options are not allowed in a project config. Most notably:

- `coverage`: coverage is done for the whole process
- `reporters`: only root-level reporters can be supported
- `resolveSnapshotPath`: only root-level resolver is respected
- all other options that don't affect test runners

All configuration options that are not supported inside a project configuration are marked with a <NonProjectOption /> sign in the ["Config"](/config/) guide. They have to be defined once in the root config file.
:::
