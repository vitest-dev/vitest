---
title: sharedViteServer | Config
outline: deep
---

# sharedViteServer <CRoot />

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--sharedViteServer=false`

Reuse the Vite server of the config that declares them for inline [projects](/guide/projects) that don't modify the Vite config. Instead of resolving a new Vite config and creating a new server for every project, such projects share the declaring config's server and its transform cache, so shared source files are transformed once instead of once per project and tests run faster. The performance improvement varies depending on the number of inline projects and how many source files they have in common.

This option _only_ applies to inline projects. Projects referenced as config files or directories always resolve their own Vite config and create their own server.

A project still gets its own Vite server when it defines Vite-level options (`plugins`, `resolve`, `define`, and so on), when its `extends` doesn't point to the declaring config, or when it defines test options that affect the Vite config:

- [`alias`](/config/alias)
- [`browser`](/guide/browser/config)
- [`css`](/config/css)
- [`deps.optimizer`](/config/deps#deps-optimizer)
- `mode`
- [`root`](/config/root)

Options like `env`, `setupFiles`, `server.deps`, or `environment` don't prevent sharing: every project keeps its own module resolution rules, module runner, and module instances on top of the shared server.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // these projects share the root Vite server
      { test: { name: 'unit', include: ['**/*.unit.test.ts'] } },
      { test: { name: 'integration', include: ['**/*.integration.test.ts'] } },
      // this project resolves its own Vite config because of `alias`
      { test: { name: 'aliased', alias: { lib: './src/lib' } } },
    ],
  },
})
```

The option applies to every level: inline projects of a [nested projects container](/guide/projects#nested-projects) share the container's server the same way.

::: warning
When projects share a server, the declaring config file is executed once instead of once per project. Plugins are instantiated once, and their `config` hooks cannot observe per-project test options. If a plugin needs to behave differently per project, disable this option or don't share the server for that project (for example, set `extends: false` or define the project in its own config file).
:::
