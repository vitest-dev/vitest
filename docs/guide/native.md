---
outline: deep
---

# Native Mode <Badge type="warning">Experimental</Badge> {#native-mode}

By default, Vitest runs tests in a very permissive "vite-node" sandbox powered by the [vite-node package](https://www.npmjs.com/package/vite-node), soon to be Vite's [Environment API](https://vite.dev/guide/api-environment.html#environment-api). Every file is categorized as either an "inline" module or an "external" module.

All "inline" modules run in the "vite-node" sandbox. It provides `import.meta`, `require`, `__dirname`, `__filename`, static `import`, and has its own module resolution mechanism. This makes it very easy to run code when you don't want to configure the environment and just need to test that the bare JavaScript logic you wrote works as intended.

All "external" modules run in native mode, meaning they are executed outside of the "vite-node" sandbox. If you are running tests in Node.js, these files are imported with the native `import` keyword and processed by Node.js directly.

While running browser tests in a permissive fake environment might be justified, running Node.js tests in a non-Node.js environment is counter-productive as it can hide and silence potential errors you may encounter in production.

## `nativeImports` Flag

Vitest 3.x comes with an experimental flag called `nativeImports` <!-- TBD --> that you can enabled under `experimental` field:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      nativeImports: true,
    },
  },
})
```

This flag disables all custom file transforms and removes polyfills that Vitest injects in the sandbox environment. Tests are still scheduled to run either in a worker thread or a child process, depending on your [`pool`](/config/#pool) option. This mode is recommended for tools using these environments natively. However, we still recommend running `jsdom`/`happy-dom` tests in a sandbox environment or in [the browser](/guide/browser) as it doesn't reauire any configuration.

This flag disables _all_ file transforms:

- test files and your source code are not processed
- your global setup files are not processed
- your custom runner/pool/environment files are not processed
- your config files is still processed by Vite's config resolution mechanism (this happens before Vitest knows the flag)

### TypeScript

If you are using TypeScript and Node.js lower than 23.6, then you will need to either:

- build your test files and source code and run those
- define a [custom loader](https://nodejs.org/api/module.html#customization-hooks) via `experimental.preload` flag

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      nativeImports: true,
      preload: ['tsx'],
    },
  },
})
```
<!-- TODO: example with tsx - just adding "tsx" is not enough -->

::: warning TypeScript with Node 22
If you are using Node.js 22.6, you can also enable native TypeScript support via `--experimental-strip-types` flag:

```shell
NODE_OPTIONS=--experimental-strip-types vitest
```
:::

If you are using Node.js 23.6 or higher, then TypeScript will be [transformed natively](https://nodejs.org/en/learn/typescript/run-natively) by Node.js. Note that Node.js will print an experimental warning for every test file.

If you are using Deno, TypeScript files should be processed as they usually are without any additional configurations.

### Disabled Features

Some Vitest features rely on files being transformed in some way. Since native mode disables file transformation, these features do not work with `nativeImport` flag:

- no `import.meta.env` in Node: `import.meta.env` is a Vite feature, use `process.env` instead
- no `import.meta.vitest`: in-source testing requires injecting values to `import.meta` which is not supported by any environment
- no `vi.mock` support: mocking modules is not supported because it relies on code transformations
- no `plugins`: plugins are not applied because there is no transformation phase
- no `alias`: aliases are not applied because there is no transformation/resolution phase
- no watch mode yet (watch mode relies on the Vite module graph)

::: warning Support is Coming
We are planning to support some of these features by using the [Node.js Loaders API](https://nodejs.org/api/module.html#customization-hooks) in the future.
:::
