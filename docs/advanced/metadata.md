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

Once a test is completed, Vitest will send a task including the result and `meta` to the Node.js process using RPC, and then report it in `onTestCaseResult` and other hooks that have access to tasks. To process this test case, you can utilize the `onTestCaseResult` method available in your reporter implementation:

```ts [custom-reporter.js]
import type { Reporter, TestCase, TestModule } from 'vitest/node'

export default {
  onTestCaseResult(testCase: TestCase) {
    // custom === 'some-custom-handler' ✅
    const { custom } = testCase.meta()
  },
  onTestRunEnd(testModule: TestModule) {
    testModule.meta().done === true
    testModule.children.at(0).meta().custom === 'some-custom-handler'
  }
} satisfies Reporter
```

::: danger BEWARE
Vitest uses different methods to communicate with the Node.js process.

- If Vitest runs tests inside worker threads, it will send data via [message port](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort)
- If Vitest uses child process, the data will be send as a serialized Buffer via [`process.send`](https://nodejs.org/api/process.html#processsendmessage-sendhandle-options-callback) API
- If Vitest runs tests in the browser, the data will be stringified using [flatted](https://www.npmjs.com/package/flatted) package

This property is also present on every test in the `json` reporter, so make sure that data can be serialized into JSON.

Also, make sure you serialize [Error properties](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm#error_types) before you set them.
:::

You can also get this information from Vitest state when tests finished running:

```ts
const vitest = await createVitest('test')
const { testModules } = await vitest.start()

const testModule = testModules[0]
testModule.meta().done === true
testModule.children.at(0).meta().custom === 'some-custom-handler'
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
