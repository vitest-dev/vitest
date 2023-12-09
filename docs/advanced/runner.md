# Test Runner

::: warning
This is advanced API. If you are just running tests, you probably don't need this. It is primarily used by library authors.
:::

You can specify a path to your test runner with the `runner` option in your configuration file. This file should have a default export with a class implementing these methods:

```ts
export interface VitestRunner {
  /**
   * First thing that's getting called before actually collecting and running tests.
   */
  onBeforeCollect?(paths: string[]): unknown
  /**
   * Called after collecting tests and before "onBeforeRun".
   */
  onCollected?(files: File[]): unknown

  /**
   * Called when test runner should cancel next test runs.
   * Runner should listen for this method and mark tests and suites as skipped in
   * "onBeforeRunSuite" and "onBeforeRunTask" when called.
   */
  onCancel?(reason: CancelReason): unknown

  /**
   * Called before running a single test. Doesn't have "result" yet.
   */
  onBeforeRunTask?(test: TaskPopulated): unknown
  /**
   * Called before actually running the test function. Already has "result" with "state" and "startTime".
   */
  onBeforeTryTask?(test: TaskPopulated, options: { retry: number; repeats: number }): unknown
  /**
   * Called after result and state are set.
   */
  onAfterRunTask?(test: TaskPopulated): unknown
  /**
   * Called right after running the test function. Doesn't have new state yet. Will not be called, if the test function throws.
   */
  onAfterTryTask?(test: TaskPopulated, options: { retry: number; repeats: number }): unknown

  /**
   * Called before running a single suite. Doesn't have "result" yet.
   */
  onBeforeRunSuite?(suite: Suite): unknown
  /**
   * Called after running a single suite. Has state and result.
   */
  onAfterRunSuite?(suite: Suite): unknown

  /**
   * If defined, will be called instead of usual Vitest suite partition and handling.
   * "before" and "after" hooks will not be ignored.
   */
  runSuite?(suite: Suite): Promise<void>
  /**
   * If defined, will be called instead of usual Vitest handling. Useful, if you have your custom test function.
   * "before" and "after" hooks will not be ignored.
   */
  runTask?(test: TaskPopulated): Promise<void>

  /**
   * Called, when a task is updated. The same as "onTaskUpdate" in a reporter, but this is running in the same thread as tests.
   */
  onTaskUpdate?(task: [string, TaskResult | undefined][]): Promise<void>

  /**
   * Called before running all tests in collected paths.
   */
  onBeforeRunFiles?(files: File[]): unknown
  /**
   * Called right after running all tests in collected paths.
   */
  onAfterRunFiles?(files: File[]): unknown
  /**
   * Called when new context for a test is defined. Useful, if you want to add custom properties to the context.
   * If you only want to define custom context with a runner, consider using "beforeAll" in "setupFiles" instead.
   *
   * This method is called for both "test" and "custom" handlers.
   *
   * @see https://vitest.dev/advanced/runner.html#your-task-function
   */
  extendTaskContext?<T extends Test | Custom>(context: TaskContext<T>): TaskContext<T>
  /**
   * Called, when certain files are imported. Can be called in two situations: when collecting tests and when importing setup files.
   */
  importFile(filepath: string, source: VitestRunnerImportSource): unknown
  /**
   * Publicly available configuration.
   */
  config: VitestRunnerConfig
}
```

When initiating this class, Vitest passes down Vitest config, - you should expose it as a `config` property.

::: warning
Vitest also injects an instance of `ViteNodeRunner` as `__vitest_executor` property. You can use it to process files in `importFile` method (this is default behavior of `TestRunner` and `BenchmarkRunner`).

`ViteNodeRunner` exposes `executeId` method, which is used to import test files in a Vite-friendly environment. Meaning, it will resolve imports and transform file content at runtime so that Node can understand it.
:::

::: tip
Snapshot support and some other features depend on the runner. If you don't want to lose it, you can extend your runner from `VitestTestRunner` imported from `vitest/runners`. It also exposes `BenchmarkNodeRunner`, if you want to extend benchmark functionality.
:::

## Your Task Function

You can extend Vitest task system with your tasks. A task is an object that is part of a suite. It is automatically added to the current suite with a `suite.task` method:

```js
// ./utils/custom.js
import { createTaskCollector, getCurrentSuite, setFn } from 'vitest/suite'

export { describe, beforeAll, afterAll } from 'vitest'

// this function will be called during collection phase:
// don't call function handler here, add it to suite tasks
// with "getCurrentSuite().task()" method
// note: createTaskCollector provides support for "todo"/"each"/...
export const myCustomTask = createTaskCollector(
  function (name, fn, timeout) {
    getCurrentSuite().task(name, {
      ...this, // so "todo"/"skip"/... is tracked correctly
      meta: {
        customPropertyToDifferentiateTask: true
      },
      handler: fn,
      timeout,
    })
  }
)
```

```js
// ./garden/tasks.test.js
import { afterAll, beforeAll, describe, myCustomTask } from '../custom.js'
import { gardener } from './gardener.js'

describe('take care of the garden', () => {
  beforeAll(() => {
    gardener.putWorkingClothes()
  })

  myCustomTask('weed the grass', () => {
    gardener.weedTheGrass()
  })
  myCustomTask.todo('mow the lawn', () => {
    gardener.mowerTheLawn()
  })
  myCustomTask('water flowers', () => {
    gardener.waterFlowers()
  })

  afterAll(() => {
    gardener.goHome()
  })
})
```

```bash
vitest ./garden/tasks.test.js
```

::: warning
If you don't have a custom runner or didn't define `runTest` method, Vitest will try to retrieve a task automatically. If you didn't add a function with `setFn`, it will fail.
:::

::: tip
Custom task system supports hooks and contexts. If you want to support property chaining (like, `only`, `skip`, and your custom ones), you can import `createChainable` from `vitest/suite` and wrap your function with it. You will need to call `custom` as `custom.call(this)`, if you decide to do this.
:::
