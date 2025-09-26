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

## Defining Metadata in Test Options

Since Vitest 4.0, you can also define metadata directly in the test options, which will be merged with metadata from all ancestor suites in the hierarchy:

```ts
describe('suite', { meta: { suiteLevel: 'parent', priority: 'medium' } }, () => {
  test('with meta options', { meta: { testLevel: 'child', priority: 'high' } }, ({ task }) => {
    // task.meta contains merged metadata:
    // { suiteLevel: 'parent', testLevel: 'child', priority: 'high' }
    // Note: test meta overrides suite meta when there are conflicts
    console.log(task.meta.suiteLevel) // 'parent'
    console.log(task.meta.testLevel) // 'child'
    console.log(task.meta.priority) // 'high' (test overrides suite)
  })

  test('inherits suite meta', ({ task }) => {
    // task.meta only contains suite metadata:
    // { suiteLevel: 'parent', priority: 'medium' }
    console.log(task.meta.suiteLevel) // 'parent'
    console.log(task.meta.priority) // 'medium'
  })
})
```

For nested describe blocks, metadata cascades through all levels of the hierarchy:

```ts
describe('Grandparent Suite', { meta: { level: 'root', priority: 'low' } }, () => {
  describe('Parent Suite', { meta: { level: 'middle', priority: 'medium' } }, () => {
    test('deeply nested test', ({ task }) => {
      // task.meta contains metadata from all ancestor suites:
      // { level: 'middle', priority: 'medium' }
      // Note: closer ancestors override distant ancestors
      console.log(task.meta.level) // 'middle' (parent overrides grandparent)
      console.log(task.meta.priority) // 'medium' (parent overrides grandparent)
    })
  })
})
```

The metadata merging follows this priority order (lowest to highest):
1. Distant ancestor suite `meta` options (e.g., grandparent suites)
2. Closer ancestor suite `meta` options (e.g., parent suites)
3. Test-level `meta` options
4. Runtime modifications via `task.meta`

## Accessing Suite vs Test Metadata

While tests get merged metadata in `task.meta`, the original suite metadata is preserved separately:

```ts
describe('suite', { meta: { component: 'auth', area: 'validation' } }, () => {
  test('example', { meta: { testType: 'integration' } }, ({ task }) => {
    // Merged metadata (suite + test)
    console.log(task.meta)
    // { component: 'auth', area: 'validation', testType: 'integration' }

    // Original suite metadata only
    console.log(task.suite.meta)
    // { component: 'auth', area: 'validation' }

    // They are different objects
    console.log(task.meta !== task.suite.meta) // true
  })
})
```

This separation allows you to:
- Access the test's complete merged metadata via `task.meta`
- Access the suite's original metadata via `task.suite.meta`
- Distinguish between suite-level and test-level metadata in reporters and custom logic

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
