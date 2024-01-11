---
title: Test Environment | Guide
---

# Test Environment

Vitest provides [`environment`](/config/#environment) option to run code inside a specific environment. You can modify how environment behaves with [`environmentOptions`](/config/#environmentoptions) option.

By default, you can use these environments:

- `node` is default environment
- `jsdom` emulates browser environment by providing Browser API, uses [`jsdom`](https://github.com/jsdom/jsdom) package
- `happy-dom` emulates browser environment by providing Browser API, and considered to be faster than jsdom, but lacks some API, uses [`happy-dom`](https://github.com/capricorn86/happy-dom) package
- `edge-runtime` emulates Vercel's [edge-runtime](https://edge-runtime.vercel.app/), uses [`@edge-runtime/vm`](https://www.npmjs.com/package/@edge-runtime/vm) package

## Environments for Specific Files

When setting `environment` option in your config, it will apply to all the test files in your project. To have more fine-grained control, you can use control comments to specify environment for specific files. Control comments are comments that start with `@vitest-environment` and are followed by the environment name:

```ts
// @vitest-environment jsdom

import { expect, test } from 'vitest'

test('test', () => {
  expect(typeof window).not.toBe('undefined')
})
```

Or you can also set [`environmentMatchGlobs`](https://vitest.dev/config/#environmentmatchglobs) option specifying the environment based on the glob patterns.

## Custom Environment

Starting from 0.23.0, you can create your own package to extend Vitest environment. To do so, create package with the name `vitest-environment-${name}` or specify a path to a valid JS/TS file (supported since 0.34.0). That package should export an object with the shape of `Environment`:

```ts
import type { Environment } from 'vitest'

export default <Environment>{
  name: 'custom',
  transformMode: 'ssr',
  // optional - only if you support "experimental-vm" pool
  async setupVM() {
    const vm = await import('node:vm')
    const context = vm.createContext()
    return {
      getVmContext() {
        return context
      },
      teardown() {
        // called after all tests with this env have been run
      }
    }
  },
  setup() {
    // custom setup
    return {
      teardown() {
        // called after all tests with this env have been run
      }
    }
  }
}
```

::: warning
Since 0.34.0 Vitest requires `transformMode` option on environment object. It should be equal to `ssr` or `web`. This value determines how plugins will transform source code. If it's set to `ssr`, plugin hooks will receive `ssr: true` when transforming or resolving files. Otherwise, `ssr` is set to `false`.
:::

You also have access to default Vitest environments through `vitest/environments` entry:

```ts
import { builtinEnvironments, populateGlobal } from 'vitest/environments'

console.log(builtinEnvironments) // { jsdom, happy-dom, node, edge-runtime }
```

Vitest also provides `populateGlobal` utility function, which can be used to move properties from object into the global namespace:

```ts
interface PopulateOptions {
  // should non-class functions be bind to the global namespace
  bindFunctions?: boolean
}

interface PopulateResult {
  // a list of all keys that were copied, even if value doesn't exist on original object
  keys: Set<string>
  // a map of original object that might have been overridden with keys
  // you can return these values inside `teardown` function
  originals: Map<string | symbol, any>
}

export function populateGlobal(global: any, original: any, options: PopulateOptions): PopulateResult
```
