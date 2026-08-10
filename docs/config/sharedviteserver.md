---
title: sharedViteServer | Config
outline: deep
---

# sharedViteServer <CRoot />

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--sharedViteServer=false`

Inline [projects](/guide/projects) that don't modify the Vite config reuse the Vite server of the config that declares them. Instead of resolving a new Vite config and creating a new server for every project, such projects share the declaring config's server and its transform cache, so shared source files are transformed once instead of once per project and tests run faster. The performance improvement varies depending on the number of inline projects and how many source files they have in common.

This option _only_ applies to inline projects. Projects referenced as config files or directories always resolve their own Vite config and create their own server.

A project still gets its own Vite server when it defines Vite-level options that change the server (`plugins`, `resolve`, and so on), when its `extends` doesn't point to the declaring config, or when it defines test options that affect the Vite config:

- [`alias`](/config/alias)
- [`browser`](/config/browser/enabled)
- [`css`](/config/css)
- [`deps.moduleDirectories`](/config/deps#deps-moduledirectories)
- [`deps.optimizer`](/config/deps#deps-optimizer)
- `mode`
- [`root`](/config/root)

Options like `env`, `setupFiles`, `server.deps`, or `environment` don't prevent sharing: every project keeps its own module resolution rules, module runner, and module instances on top of the shared server.

The same applies to Vite-level values that don't change the server: an empty `plugins` list (`plugins: isCI ? [ciPlugin()] : []`), `define` entries that Vitest applies at runtime (`import.meta.env.*`, `process.env.*` and global identifiers with JSON values), and `define` entries that repeat the declaring config's values. Dotted replacements like `'import.meta.dev'` and references to code like `'__DEV__': 'process.env.DEV'` are baked into the server's transforms, so a project that defines them gets its own server.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // these projects share the root Vite server
      { test: { name: 'unit', include: ['**/*.unit.test.ts'] } },
      { test: { name: 'integration', include: ['**/*.integration.test.ts'] } },
      // `__DEV__` is applied at runtime, so this project also shares the server
      { define: { __DEV__: 'true' }, test: { name: 'dev' } },
      // this project resolves its own Vite config because of `alias`
      { test: { name: 'aliased', alias: { lib: './src/lib' } } },
    ],
  },
})
```

::: tip
If every project repeats the same transform-affecting option, such as a dotted `define` or a plugin, move it to the declaring config. The projects inherit it from the shared server and keep sharing:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // hoisted: applied once on the shared server
  define: { 'import.meta.dev': 'false' },
  test: {
    projects: [
      { test: { name: 'unit', include: ['**/*.unit.test.ts'] } },
      { test: { name: 'integration', include: ['**/*.integration.test.ts'] } },
    ],
  },
})
```
:::

To see the decision for every project, including why a project resolves its own server, run Vitest with `DEBUG=vitest:projects`. API consumers can check whether a project reuses the declaring config's server via [`project.sharedViteServer`](/api/advanced/test-project#sharedviteserver).

The option applies to every level: inline projects of a [nested projects container](/guide/projects#nested-projects) share the container's server the same way.

::: warning
When projects share a server, the declaring config file is executed once instead of once per project. Plugins are instantiated once, and their `config` hooks cannot observe per-project test options. If a plugin needs to behave differently per project, disable this option or don't share the server for that project (for example, set `extends: false` or define the project in its own config file).
:::
