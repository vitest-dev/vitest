---
title: Plugin API
outline: deep
---

# Plugin API <Version>3.1.0</Version> {#plugin-api}

::: warning
This is an advanced API. If you just want to [run tests](/guide/), you probably don't need this. It is primarily used by library authors.

This guide assumes you know how to work with [Vite plugins](https://vite.dev/guide/api-plugin.html).
:::

Vitest supports an experimental `configureVitest` [plugin](https://vite.dev/guide/api-plugin.html) hook hook since version 3.1. Any feedback regarding this API is welcome in [GitHub](https://github.com/vitest-dev/vitest/discussions/7104).

::: code-group
```ts [only vitest]
import type { Vite, VitestPluginContext } from 'vitest/node'

export function plugin(): Vite.Plugin {
  return {
    name: 'vitest:my-plugin',
    configureVitest(context: VitestPluginContext) {
      // ...
    }
  }
}
```
```ts [vite and vitest]
/// <reference types="vitest/config" />

import type { Plugin } from 'vite'

export function plugin(): Plugin {
  return {
    name: 'vitest:my-plugin',
    transform() {
      // ...
    },
    configureVitest(context) {
      // ...
    }
  }
}
```
:::

::: tip TypeScript
Vitest re-exports all Vite type-only imports via a `Vite` namespace, which you can use to keep your versions in sync. However, if you are writing a plugin for both Vite and Vitest, you can continue using the `Plugin` type from the `vite` entrypoint. Just make sure you have `vitest/config` referenced somewhere so that `configureVitest` is augmented correctly:

```ts
/// <reference types="vitest/config" />
```
:::

Unlike [`reporter.onInit`](/advanced/api/reporters#oninit), this hooks runs early in Vitest lifecycle allowing you to make changes to configuration like `coverage` and `reporters`. A more notable change is that you can manipulate the global config from a [workspace project](/guide/workspace) if your plugin is defined in the project and not in the global config.

## Context

### project

The current [test project](./test-project) that the plugin belongs to.

::: warning Browser Mode
Note that if you are relying on a browser feature, the `project.browser` field is not set yet. Use [`reporter.onBrowserInit`](./reporters#onbrowserinit) event instead.
:::

### vitest

The global [Vitest](./vitest) instance. You can change the global configuration by directly mutating the `vitest.config` property:

```ts
vitest.config.coverage.enabled = false
vitest.config.reporters.push([['my-reporter', {}]])
```

::: warning Config is Resolved
Note that Vitest already resolved the config, so some types might be different from the usual user configuration. This also means that some properties will not be resolved again, like `setupFile`. If you are adding new files, make sure to resolve it first.

At this point reporters are not created yet, so modifying `vitest.reporters` will have no effect because it will be overwritten. If you need to inject your own reporter, modify the config instead.
:::

### injectTestProjects

```ts
function injectTestProjects(
  config: TestProjectConfiguration | TestProjectConfiguration[]
): Promise<TestProject[]>
```

This methods accepts a config glob pattern, a filepath to the config or an inline configuration. It returns an array of resolved [test projects](./test-project).

```ts
// inject a single project with a custom alias
const newProjects = await injectTestProjects({
  // you can inherit the current project config by referencing `configFile`
  // note that you cannot have a project with the name that already exists,
  // so it's a good practice to define a custom name
  configFile: project.vite.config.configFile,
  test: {
    name: 'my-custom-alias',
    alias: {
      customAlias: resolve('./custom-path.js'),
    },
  },
})
```

::: warning Projects are Filtered
Vitest filters projects during the config resolution, so if the user defined a filter, injected project might not be resolved unless it [matches the filter](./vitest#matchesprojectfilter). You can update the filter via the `vitest.config.project` option to always include your workspace project:

```ts
vitest.config.project.push('my-project-name')
```

Note that this will only affect projects injected with [`injectTestProjects`](#injecttestprojects) method.
:::

::: tip Referencing the Current Config
If you want to keep the user configuration, you can specify the `configFile` property. All other properties will be merged with the user defined config.

The project's `configFile` can be accessed in Vite's config: `project.vite.config.configFile`.

Note that this will also inherit the `name` - Vitest doesn't allow multiple projects with the same name, so this will throw an error. Make sure you specified a different name. You can access the current name via the `project.name` property and all used names are available in the `vitest.projects` array.
:::
