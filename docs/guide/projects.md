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

Vitest will treat every folder in `packages` as a separate project even if it doesn't have a config file inside. If a project entry resolves to a file (either from a glob pattern or a direct file path), Vitest will validate that the name either:

- starts with `vitest.config` or `vite.config` (for example, `vitest.config.unit.ts`)
- or matches `vitest.<name>.config.*` / `vite.<name>.config.*`, where `<name>` can contain letters, numbers, `_`, and `-`

For example, these config files are valid:

- `vitest.config.ts`
- `vite.config.js`
- `vitest.unit.config.ts`
- `vitest.e2e-node.config.ts`
- `vite.e2e.config.js`
- `vitest.config.unit.js`
- `vite.config.e2e.js`

To exclude folders and files, you can use the negation pattern:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // include all folders inside "packages" except "excluded"
    projects: [
      'packages/*',
      '!packages/excluded'
    ],
  },
})
```

If you have a nested structure where some folders need to be projects, but other folders have their own subfolders, you have to use brackets to avoid matching the parent folder:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

// For example, this will create projects:
// packages/a
// packages/b
// packages/business/c
// packages/business/d
// Notice that "packages/business" is not a project itself

export default defineConfig({
  test: {
    projects: [
      // matches every folder inside "packages" except "business"
      'packages/!(business)',
      // matches every folder inside "packages/business"
      'packages/business/*',
    ],
  },
})
```

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
        // inline projects inherit the options
        // from this config file by default
        test: {
          include: ['tests/**/*.{browser}.test.{ts,js}'],
          // it is recommended to define a name when using inline configs
          name: 'happy-dom',
          environment: 'happy-dom',
        }
      },
      {
        // add "extends: false" to ignore
        // the options defined in this config file
        extends: false,
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

Projects defined with an inline configuration inherit all options from the root-level configuration. This is controlled by the `extends` option, which is enabled by default since Vitest 5.0:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    pool: 'threads',
    projects: [
      {
        // inherits options from this config like plugins and pool
        // (`extends: true` is the default)
        test: {
          name: 'unit',
          include: ['**/*.unit.test.ts'],
        },
      },
      {
        // won't inherit any options from this config
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

The `extends` option also accepts a path to another config file if you want to inherit options from a config file other than the root config:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        extends: './vitest.shared.ts',
        test: {
          name: 'unit',
          include: ['**/*.unit.test.ts'],
        },
      },
    ],
  },
})
```

All options from the extended config are merged with the project's own options. Note that arrays like `setupFiles` are concatenated, not overridden. A few options are treated specially:

- `name` and `projects` are never inherited.
- `globalSetup` is not inherited from the root config: the root-level `globalSetup` already runs once per test run, so inheriting it would run the same files again for every project. It is still inherited when extending a non-root config file.
- The project's own `tags` replace the inherited array instead of being merged with it.

If you run Vitest through the [advanced API](/guide/advanced/), see [Project Configuration Resolution](/guide/advanced/#project-configuration-resolution) for how the programmatic configuration participates in inheritance.

Projects referenced as config files or directories do not inherit any options from the root config. You can create a shared config file and merge it with the project config yourself:

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

::: danger Unsupported Options
Some of the configuration options are not allowed in a project config. Most notably:

- `coverage`: coverage is done for the whole process
- `reporters`: only root-level reporters can be supported
- `resolveSnapshotPath`: only root-level resolver is respected
- `attachmentsDir`: attachments are stored in one root-level directory shared by all projects
- all other options that don't affect test runners

All configuration options that are not supported inside a project configuration are marked with a <CRoot /> icon next to their name. They can only be defined once in the root config file.
:::
