# @vitest/web-worker

> Web Worker support for Vitest testing. Doesn't require JSDom.

Simulates Web Worker, but in the same thread.

Supported:

- `new Worker(path)`
- `new SharedWorker(path)`
- `import MyWorker from './worker?worker'`
- `import MySharedWorker from './worker?sharedworker'`

## Installing

```bash
# with npm
npm install -D @vitest/web-worker

# with pnpm
pnpm install -D @vitest/web-worker

# with yarn
yarn add --dev @vitest/web-worker
```

## Usage

Just import `@vitest/web-worker` in your test file to test only in current suite.

Or add `@vitest/web-worker` in your `setupFiles`, if you want to have a global support.

```ts
import { defineConfig } from 'vitest/node'

export default defineConfig({
  test: {
    setupFiles: ['@vitest/web-worker'],
  },
})
```

You can also import `defineWebWorkers` from `@vitest/web-worker/pure` to define workers, whenever you need:

```js
import { defineWebWorkers } from '@vitest/web-worker/pure'

if (process.env.SUPPORT_WORKERS) {
  defineWebWorkers({ clone: 'none' })
}
```

It accepts options:

- `clone`: `'native' | 'ponyfill' | 'none'`. Defines how should `Worker` clone message, when transferring data. Applies only to `Worker` communication. `SharedWorker` uses `MessageChannel` from Node's `worker_threads` module, and is not configurable.

> **Note**
> Requires Node 17, if you want to use native `structuredClone`. Otherwise, it fallbacks to [polyfill](https://github.com/ungap/structured-clone), if not specified as `none`. You can also configure this option with `VITEST_WEB_WORKER_CLONE` environmental variable.

## Examples

```ts
// worker.ts
self.onmessage = (e) => {
  self.postMessage(`${e.data} world`)
}
```

```ts
// worker.test.ts
import '@vitest/web-worker'
import MyWorker from '../worker?worker'

let worker = new MyWorker()
// new Worker is also supported
worker = new Worker(new URL('../src/worker.ts', import.meta.url))

worker.postMessage('hello')
worker.onmessage = (e) => {
  // e.data equals to 'hello world'
}
```

## Notes

- Worker does not support `onmessage = () => {}`. Please, use `self.onmessage = () => {}`.
- Shared worker does not support `onconnect = () => {}`. Please, use `self.onconnect = () => {}`.
- Transferring Buffer will not change its `byteLength`.
- You have access to shared global space as your tests.
- You can debug your worker, using `DEBUG=vitest:web-worker` environmental variable.
