# Task Metadata

::: warning
Vitest exposes experimental private API. Breaking changes might not follow semver, please pin Vitest's version when using it.
:::

If you are developing a custom reporter or using Vitest Node.js API, you might want to pass down some data from tests that are running in different context to your reporter or custom Vitest handler.

Vitest provides `meta` property on any task (suite or test) that you can reuse between your tests and Node.js process. Beware that it is not a two-way communication, `meta` property can only be set form inside the test context. Changes inside Node.js context will not be reflected in your tests.

You can populate `meta` property on test context or inside `beforeAll`/`afterAll` hooks for suite tasks.

```ts
afterAll((suite) => {
  suite.meta ??= {}
  suite.meta.done = true
})

test('custom', ({ task }) => {
  task.meta = { custom: 'some-custom-hanlder' }
})
```

When test finishes, Vitest will send a task with result and meta via RPC to Node.js process. You can intercept it with `onTaskUpdate` reporter method:

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
    files[0].tasks[0].meta.custom === 'some-custom-hanlder'
  }
}
```

::: warn
Vitest can send several tasks at the same time if several tests finished in a short period of time.
:::

You can also get this information from Vitest state, when tests finished running:

```ts
const vitest = await createVitest('test')
await vitest.start()
vitest.state.getFiles()[0].meta.done === true
vitest.state.getFiles()[0].tasks[0].meta.custom === 'some-custom-hanlder'
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