# Custom Pool

::: warning
This is an advanced, experimental and very low-level API. If you just want to [run tests](/guide/), you probably don't need this. It is primarily used by library authors.
:::

Vitest runs tests in a pool. By default, there are several pool runtimes:

- `threads` to run tests using `node:worker_threads` (isolation is provided with a new worker context)
- `forks` to run tests using `node:child_process` (isolation is provided with a new `child_process.fork` process)
- `vmThreads` to run tests using `node:worker_threads` (but isolation is provided with `vm` module instead of a new worker context)
- `browser` to run tests using browser providers
- `typescript` to run typechecking on tests

::: tip
See [`vitest-pool-example`](https://www.npmjs.com/package/vitest-pool-example) for example of a custom pool runtime implementation.
:::

## Usage

You can provide your own pool runtime by a function that returns `PoolRuntimeInitializer`.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import customPool from './my-custom-pool.ts'

export default defineConfig({
  test: {
    // will run every file with a custom pool by default
    pool: customPool({
      customProperty: true,
    })
  },
})
```

If you need to run tests in different pools, use the [`projects`](/guide/projects) feature:

```ts [vitest.config.ts]
import customPool from './my-custom-pool.ts'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          pool: 'threads',
        },
      },
      {
        extends: true,
        test: {
          pool: customPool({
            customProperty: true,
          })
        }
      }
    ],
  },
})
```

## API

The `pool` option accepts a `PoolRuntimeInitializer` that can be used for custom pool runtimes. The `runtime` property should indicate name of the custom pool runtime. It should be identical with your runtime's `name` property.

```ts [my-custom-pool.ts]
import type { PoolRuntimeInitializer } from 'vitest/node'

export function customPool(customOptions: CustomOptions): PoolRuntimeInitializer {
  return {
    runtime: 'custom-pool',
    createWorker: options => new CustomPoolWorker(options, customOptions),
  }
}
```

In your `CustomPoolWorker` you need to define all required methods:

```ts [my-custom-pool.ts]
import { BaseRuntime } from 'vitest/node'
import type { PoolRuntimeOptions, PoolRuntimeWorker, WorkerRequest } from 'vitest/node'

class CustomPoolRuntime implements PoolRuntimeWorker {
  name = 'custom-pool'
  private customOptions: CustomOptions

  constructor(options: PoolRuntimeOptions, customOptions: CustomOptions) {
    this.customOptions = customOptions
  }

  send(message: WorkerRequest): void {
    // Provide way to send your worker a message
  }

  on(event: string, callback: (arg: any) => void): void {
    // Provide way to listen to your workers events, e.g. message, error, exit
  }

  off(event: string, callback: (arg: any) => void): void {
    // Provide way to unsubscribe `onWorker` listeners
  }

  async start() {
    // do something when the worker is started
  }

  async stop() {
    // cleanup the state
  }

  deserialize(data) {
    return data
  }
}
```

Your `CustomPoolRuntime` will be controlling how your custom test runner worker life cycles and communication channel works. For example, your `CustomPoolRuntime` could launch a `node:worker_threads` `Worker`, and provide communication via `Worker.postMessage` and `parentPort`.

In your worker file, you can import helper utilities from `vitest/worker`:

```ts [my-worker.ts]
import { init, runBaseTests } from 'vitest/worker'

init({
  send: (response) => {
    // Provider way to send this message to CustomPoolRuntime's onWorker as message event
  },
  subscribe: (callback) => {
    // Provide a way to listen CustomPoolRuntime's "postMessage" calls
  },
  off: (callback) => {
    // Provider a way to unsubscribe the `subscribe` listeners
  },

  worker: {
    post: (v) => {
      // Provider way to send this message to CustomPoolRuntime's onWorker as message event
      // This should be same as "send"
    },
    on: (fn) => {
      // Provide a way to listen CustomPoolRuntime's "postMessage" calls
      // This should be same as "subscribe"
    },
    runTests: state => runBaseTests('run', state),
    collectTests: state => runBaseTests('collect', state),
  },
})
```
