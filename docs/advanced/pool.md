# Custom Pool

::: warning
This is advanced API. If you are just running tests, you probably don't need this. It is primarily used by library authors.
:::

Vitest runs tests in pools. By default, there are several pools:

- `threads` to run tests using `node:worker_threads` (isolation is provided with a new worker context)
- `forks` to run tests using `node:child_process` (isolation is provided with a new `child_process.fork` process)
- `vmThreads` to run tests using `node:worker_threads` (but isolation is provided with `vm` module instead of a new worker context)
- `browser` to run tests using browser providers
- `typescript` to run typechecking on tests

You can provide your own pool by specifying a file path:

```ts
export default defineConfig({
  test: {
    // will run every file with a custom pool by default
    pool: './my-custom-pool.ts',
    // you can provide options using `poolOptions` object
    poolOptions: {
      myCustomPool: {
        customProperty: true,
      },
    },
    // you can also specify pool for a subset of files
    poolMatchGlobs: [
      ['**/*.custom.test.ts', './my-custom-pool.ts'],
    ],
  },
})
```

## API

The file specified in `pool` option should export a function (can be async) that accepts `Vitest` interface as its first option. This function needs to return an object matching `ProcessPool` interface:

```ts
import { ProcessPool, WorkspaceProject } from 'vitest/node'

export interface ProcessPool {
  name: string
  runTests: (files: [project: WorkspaceProject, testFile: string][], invalidates?: string[]) => Promise<void>
  close?: () => Promise<void>
}
```

The function is called only once (unless the server config was updated), and it's generally a good idea to initialize everything you need for tests inside that function and reuse it when `runTests` is called.

Vitest calls `runTest` when new tests are scheduled to run. It will not call it if `files` is empty. The first argument is an array of tuples: the first element is a reference to a workspace project and the second one is an absolute path to a test file. Files are sorted using [`sequencer`](/config/#sequence.sequencer) before `runTests` is called. It's possible (but unlikely) to have the same file twice, but it will always have a different project - this is implemented via [`vitest.workspace.ts`](/guide/workspace) configuration.

Vitest will wait until `runTests` is executed before finishing a run (i.e., it will emit [`onFinished`](/guide/reporters) only after `runTests` is resolved).

If you are using a custom pool, you will have to provide test files and their results yourself - you can reference [`vitest.state`](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/src/node/state.ts) for that (most important are `collectFiles` and `updateTasks`). Vitest uses `startTests` function from `@vitest/runner` package to do that.

To communicate between different processes, you can create methods object using `createMethodsRPC` from `vitest/node`, and use any form of communication that you prefer. For example, to use WebSockets with `birpc` you can write something like this:

```ts
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { WorkspaceProject, createMethodsRPC } from 'vitest/node'

function createRpc(project: WorkspaceProject, wss: WebSocketServer) {
  return createBirpc(
    createMethodsRPC(project),
    {
      post: msg => wss.send(msg),
      on: fn => wss.on('message', fn),
      serialize: stringify,
      deserialize: parse,
    },
  )
}
```

To make sure every test is collected, you would call `ctx.state.collectFiles` and report it to Vitest reporters:

```ts
async function runTests(project: WorkspaceProject, tests: string[]) {
  // ... running tests, put into "files" and "tasks"
  const methods = createMethodsRPC(project)
  await methods.onCollected(files)
  // most reporters rely on results being updated in "onTaskUpdate"
  await methods.onTaskUpdate(tasks)
}
```

You can see a simple example in [pool/custom-pool.ts](https://github.com/vitest-dev/vitest/blob/main/test/run/pool-custom-fixtures/pool/custom-pool.ts).
