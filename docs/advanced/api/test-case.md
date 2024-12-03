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

This is a test name that was passed to the `test` function:

```ts
import { test } from 'vitest'

test('the validation works correctly', () => {
  // ...
})
```

```ts
declare class TestCase {
  readonly module: TestModule
  /**
   * Name of the test.
   */
  readonly name: string
  /**
   * Full name of the test including all parent suites separated with `>`.
   */
  readonly fullName: string
  /**
   * Unique identifier.
   * This ID is deterministic and will be the same for the same test across multiple runs.
   * The ID is based on the project name, module id and test position.
   */
  readonly id: string
  /**
   * Location in the module where the test was defined.
   * Locations are collected only if `includeTaskLocation` is enabled in the config.
   */
  readonly location: { line: number; column: number } | undefined
  /**
   * Parent suite. If the test was called directly inside the module, the parent will be the module itself.
   */
  readonly parent: TestSuite | TestModule
  /**
   * Options that test was initiated with.
   */
  readonly options: TaskOptions
  /**
   * Checks if the test did not fail the suite.
   * If the test is not finished yet or was skipped, it will return `true`.
   */
  ok(): boolean
  /**
   * Checks if the test was skipped.
   */
  skipped(): boolean
  /**
   * Custom metadata that was attached to the test during its execution.
   */
  meta(): TaskMeta
  /**
   * Test results. Will be `undefined` if test is not finished yet or was just collected.
   */
  result(): TestResult | undefined
  /**
   * Useful information about the test like duration, memory usage, etc.
   */
  diagnostic(): TestDiagnostic | undefined
}

export type TestResult = TestResultPassed | TestResultFailed | TestResultSkipped

export interface TestResultPassed {
  /**
   * The test passed successfully.
   */
  state: 'passed'
  /**
   * Errors that were thrown during the test execution.
   *
   * **Note**: If test was retried successfully, errors will still be reported.
   */
  errors: TestError[] | undefined
}

export interface TestResultFailed {
  /**
   * The test failed to execute.
   */
  state: 'failed'
  /**
   * Errors that were thrown during the test execution.
   */
  errors: TestError[]
}

export interface TestResultSkipped {
  /**
   * The test was skipped with `only`, `skip` or `todo` flag.
   * You can see which one was used in the `mode` option.
   */
  state: 'skipped'
  /**
   * Skipped tests have no errors.
   */
  errors: undefined
}

export interface TestDiagnostic {
  /**
   * If the duration of the test is above `slowTestThreshold`.
   */
  slow: boolean
  /**
   * The amount of memory used by the test in bytes.
   * This value is only available if the test was executed with `logHeapUsage` flag.
   */
  heap: number | undefined
  /**
   * The time it takes to execute the test in ms.
   */
  duration: number
  /**
   * The time in ms when the test started.
   */
  startTime: number
  /**
   * The amount of times the test was retried.
   */
  retryCount: number
  /**
   * The amount of times the test was repeated as configured by `repeats` option.
   * This value can be lower if the test failed during the repeat and no `retry` is configured.
   */
  repeatCount: number
  /**
   * If test passed on a second retry.
   */
  flaky: boolean
}
```
