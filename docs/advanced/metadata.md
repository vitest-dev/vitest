# Task Metadata

::: warning
Vitest exposes experimental private API. Breaking changes might not follow SemVer, please pin Vitest's version when using it.
:::

If you are developing a custom reporter or using Vitest Node.js API, you might find it useful to pass data from tests that are being executed in various contexts to your reporter or custom Vitest handler.

To accomplish this, relying on the [test context](/guide/test-context) is not feasible since it cannot be serialized. However, with Vitest, you can utilize the `meta` property available on every task (suite or test) to share data between your tests and the Node.js process. It's important to note that this communication is one-way only, as the `meta` property can only be modified from within the test context. Any changes made within the Node.js context will not be visible in your tests.

You can populate `meta` property on test context or inside `beforeAll`/`afterAll` hooks for suite tasks.

```ts
afterAll((suite) => {
  suite.meta.done = true
})

test('custom', ({ task }) => {
  task.meta.custom = 'some-custom-handler'
})
```

Once a test is completed, Vitest will send a task including the result and `meta` to the Node.js process using RPC. To intercept and process this task, you can utilize the `onTaskUpdate` method available in your reporter implementation:

```ts
// custom-reporter.js
export default {
  // you can intercept packs if needed
  onTaskUpdate(packs) {
    const [id, result, meta] = packs[0]
  },
  // meta is located on every task inside "onFinished"
  onFinished(files) {
    files[0].meta.done === true
    files[0].tasks[0].meta.custom === 'some-custom-handler'
  }
}
```

::: warning
Vitest can send several tasks at the same time if several tests are completed in a short period of time.
:::

::: danger BEWARE
Vitest uses different methods to communicate with the Node.js process.

- If Vitest runs tests inside worker threads, it will send data via [message port](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort)
- If Vitest uses child process, the data will be send as a serialized Buffer via [`process.send`](https://nodejs.org/api/process.html#processsendmessage-sendhandle-options-callback) API
- If Vitest runs tests in the browser, the data will be stringified using [flatted](https://www.npmjs.com/package/flatted) package

The general rule of thumb is that you can send almost anything, except for functions, Promises, regexp (`v8.stringify` cannot serialize it, but you can send a string version and parse it in the Node.js process yourself), and other non-serializable data, but you can have cyclic references inside.

Also, make sure you serialize [Error properties](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#error_types) before you set them.
:::

You can also get this information from Vitest state when tests finished running:

```ts
const vitest = await createVitest('test')
await vitest.start()
vitest.state.getFiles()[0].meta.done === true
vitest.state.getFiles()[0].tasks[0].meta.custom === 'some-custom-handler'
```

It's also possible to extend type definitions when using TypeScript:

```ts
declare module 'vitest' {
  interface TaskMeta {
    done?: boolean
    custom?: string
  }
}
```
