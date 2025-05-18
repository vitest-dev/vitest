# TestCase

The `TestCase` class represents a single test. This class is only available in the main thread. Refer to the ["Runner API"](/advanced/runner#tasks) if you are working with runtime tasks.

The `TestCase` instance always has a `type` property with the value of `test`. You can use it to distinguish between different task types:

```ts
if (task.type === 'test') {
  task // TestCase
}
```

## project

This references the [`TestProject`](/advanced/api/test-project) that the test belongs to.

## module

This is a direct reference to the [`TestModule`](/advanced/api/test-module) where the test is defined.

## name

This is a test name that was passed to the `test` function.

```ts
import { test } from 'vitest'

// [!code word:'the validation works correctly']
test('the validation works correctly', () => {
  // ...
})
```

## fullName

The name of the test including all parent suites separated with `>` symbol. This test has a full name "the validation logic > the validation works correctly":

```ts
import { describe, test } from 'vitest'

// [!code word:'the validation works correctly']
// [!code word:'the validation logic']
describe('the validation logic', () => {
  test('the validation works correctly', () => {
    // ...
  })
})
```

## id

This is test's unique identifier. This ID is deterministic and will be the same for the same test across multiple runs. The ID is based on the [project](/advanced/api/test-project) name, module ID and test order.

The ID looks like this:

```
1223128da3_0_0
^^^^^^^^^^ the file hash
           ^ suite index
             ^ test index
```

::: tip
You can generate file hash with `generateFileHash` function from `vitest/node` which is available since Vitest 3:

```ts
import { generateFileHash } from 'vitest/node'

const hash = generateFileHash(
  '/file/path.js', // relative path
  undefined, // the project name or `undefined` is not set
)
```
:::

::: danger
Don't try to parse the ID. It can have a minus at the start: `-1223128da3_0_0_0`.
:::

## location

The location in the module where the test was defined. Locations are collected only if [`includeTaskLocation`](/config/#includetasklocation) is enabled in the config. Note that this option is automatically enabled if `--reporter=html`, `--ui` or `--browser` flags are used.

The location of this test will be equal to `{ line: 3, column: 1 }`:

```ts:line-numbers {3}
import { test } from 'vitest'

test('the validation works correctly', () => {
  // ...
})
```

## parent

Parent [suite](/advanced/api/test-suite). If the test was called directly inside the [module](/advanced/api/test-module), the parent will be the module itself.

## options

```ts
interface TaskOptions {
  readonly each: boolean | undefined
  readonly fails: boolean | undefined
  readonly concurrent: boolean | undefined
  readonly shuffle: boolean | undefined
  readonly retry: number | undefined
  readonly repeats: number | undefined
  readonly mode: 'run' | 'only' | 'skip' | 'todo'
}
```

The options that test was collected with.

## ok

```ts
function ok(): boolean
```

Checks if the test did not fail the suite. If the test is not finished yet or was skipped, it will return `true`.

## meta

```ts
function meta(): TaskMeta
```

Custom [metadata](/advanced/metadata) that was attached to the test during its execution. The meta can be attached by assigning a property to the `ctx.task.meta` object during a test run:

```ts {3,6}
import { test } from 'vitest'

test('the validation works correctly', ({ task }) => {
  // ...

  task.meta.decorated = false
})
```

If the test did not finish running yet, the meta will be an empty object.

## result

```ts
function result(): TestResult
```

Test results. If test is not finished yet or was just collected, it will be equal to `TestResultPending`:

```ts
export interface TestResultPending {
  /**
   * The test was collected, but didn't finish running yet.
   */
  readonly state: 'pending'
  /**
   * Pending tests have no errors.
   */
  readonly errors: undefined
}
```

If the test was skipped, the return value will be `TestResultSkipped`:

```ts
interface TestResultSkipped {
  /**
   * The test was skipped with `skip` or `todo` flag.
   * You can see which one was used in the `options.mode` option.
   */
  readonly state: 'skipped'
  /**
   * Skipped tests have no errors.
   */
  readonly errors: undefined
  /**
   * A custom note passed down to `ctx.skip(note)`.
   */
  readonly note: string | undefined
}
```

::: tip
If the test was skipped because another test has `only` flag, the `options.mode` will be equal to `skip`.
:::

If the test failed, the return value will be `TestResultFailed`:

```ts
interface TestResultFailed {
  /**
   * The test failed to execute.
   */
  readonly state: 'failed'
  /**
   * Errors that were thrown during the test execution.
   */
  readonly errors: ReadonlyArray<TestError>
}
```

If the test passed, the return value will be `TestResultPassed`:

```ts
interface TestResultPassed {
  /**
   * The test passed successfully.
   */
  readonly state: 'passed'
  /**
   * Errors that were thrown during the test execution.
   */
  readonly errors: ReadonlyArray<TestError> | undefined
}
```

::: warning
Note that the test with `passed` state can still have errors attached - this can happen if `retry` was triggered at least once.
:::

## diagnostic

```ts
function diagnostic(): TestDiagnostic | undefined
```

Useful information about the test like duration, memory usage, etc:

```ts
interface TestDiagnostic {
  /**
   * If the duration of the test is above `slowTestThreshold`.
   */
  readonly slow: boolean
  /**
   * The amount of memory used by the test in bytes.
   * This value is only available if the test was executed with `logHeapUsage` flag.
   */
  readonly heap: number | undefined
  /**
   * The time it takes to execute the test in ms.
   */
  readonly duration: number
  /**
   * The time in ms when the test started.
   */
  readonly startTime: number
  /**
   * The amount of times the test was retried.
   */
  readonly retryCount: number
  /**
   * The amount of times the test was repeated as configured by `repeats` option.
   * This value can be lower if the test failed during the repeat and no `retry` is configured.
   */
  readonly repeatCount: number
  /**
   * If test passed on a second retry.
   */
  readonly flaky: boolean
}
```

::: info
`diagnostic()` will return `undefined` if the test was not scheduled to run yet.
:::
