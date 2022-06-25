# @vitest/web-worker

> Web Worker support for Vitest testing. Doesn't require JSDom.

Simulates Web Worker, but in the same thread. Supports both `new Worker(url)` and `import from './worker?worker`.

## Installing

```bash
# with npm
npm install -D @vitest/web-worker

# with pnpm
pnpm install -D @vitest/web-worker

# with yarn
yarn install -D @vitest/web-worker
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

## Examples

```ts
// worker.ts
import '@vitest/web-worker'
import MyWorker from '../worker?worker'

self.onmessage = (e) => {
  self.postMessage(`${e.data} world`)
}

// worker.test.ts
let worker = new MyWorker()
// new Worker is also supported
worker = new Worker(new URL('../src/worker.ts', import.meta.url))

worker.postMessage('hello')
worker.onmessage = (e) => {
  // e.data equals to 'hello world'
}
```

## Notice

- Does not support `onmessage = () => {}`. Please, use `self.onmessage = () => {}`.
