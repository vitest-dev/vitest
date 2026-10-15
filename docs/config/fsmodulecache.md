---
title: fsModuleCache | Config
outline: deep
---

# fsModuleCache <Version>5.0.0</Version>

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--fsModuleCache`, `--fsModuleCache=false`

In watch mode, Vitest caches all transformed files in memory, which makes reruns fast. However, this cache is discarded once the test run finishes. Enabling this option allows Vitest to persist the transformed modules on the file system, so they can be reused across reruns and separate Vitest processes.

A single cache directory is shared by every project in the workspace. By default it lives in `node_modules` at the workspace root (so it is naturally invalidated when dependencies are reinstalled); use [`fsModuleCachePath`](/config/fsmodulecachepath) to change its location. You can delete the cache by running [`vitest --clearCache`](/guide/cli#clearcache).

::: warning BROWSER SUPPORT
At the moment, this option does not affect [the browser](/guide/browser/).
:::

You can debug if your modules are cached by running vitest with a `DEBUG=vitest:cache:fs` environment variable:

```shell
DEBUG=vitest:cache:fs vitest --fsModuleCache
```

::: tip
The location of the cache is a single, workspace-wide directory. See [`fsModuleCachePath`](/config/fsmodulecachepath) to move it.
:::

## Known Issues

Vitest creates a persistent file hash based on file content, its id, Vite's environment configuration and coverage status. Vitest tries to use as much information as it has about the configuration, but it is still incomplete. At the moment, it is not possible to track your plugin options because there is no standard interface for it.

If you have a plugin that relies on things outside the file content or the public configuration (like reading another file or a folder), it's possible that the cache will get stale. To work around that, you can define a [cache key generator](/api/advanced/plugin#definecachekeygenerator) to specify a dynamic option or to opt out of caching for that module:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'vitest-cache',
      configureVitest({ defineCacheKeyGenerator }) {
        defineCacheKeyGenerator(({ id, sourceCode }) => {
          // never cache this id
          if (id.includes('do-not-cache')) {
            return false
          }

          // cache this file based on the value of a dynamic variable
          if (sourceCode.includes('myDynamicVar')) {
            return process.env.DYNAMIC_VAR_VALUE
          }
        })
      }
    }
  ],
  test: {
    fsModuleCache: true,
  },
})
```

If you are a plugin author, consider defining a [cache key generator](/api/advanced/plugin#definecachekeygenerator) in your plugin if it can be registered with different options that affect the transform result.

On the other hand, if your plugin should not affect the cache key, you can opt out by setting `api.vitest.ignoreFsModuleCache` to `true`:

```js [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: 'vitest-cache',
      api: {
        vitest: {
          ignoreFsModuleCache: true,
        },
      },
    },
  ],
  test: {
    fsModuleCache: true,
  },
})
```

Note that you can still define the cache key generator even if the plugin opts out of module caching.
