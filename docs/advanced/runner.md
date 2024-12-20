# Runner API

::: warning
This is advanced API. If you just want to [run tests](/guide/), you probably don't need this. It is primarily used by library authors.
:::

You can specify a path to your test runner with the `runner` option in your configuration file. This file should have a default export with a class constructor implementing these methods:

```ts
export interface VitestRunner {
  /**
   * First thing that's getting called before actually collecting and running tests.
   */
  onBeforeCollect?: (paths: string[]) => unknown
  /**
   * Called after collecting tests and before "onBeforeRun".
   */
  onCollected?: (files: File[]) => unknown

  /**
   * Called when test runner should cancel next test runs.
   * Runner should listen for this method and mark tests and suites as skipped in
   * "onBeforeRunSuite" and "onBeforeRunTask" when called.
   */
  onCancel?: (reason: CancelReason) => unknown

  /**
   * Called before running a single test. Doesn't have "result" yet.
   */
  onBeforeRunTask?: (test: TaskPopulated) => unknown
  /**
   * Called before actually running the test function. Already has "result" with "state" and "startTime".
   */
  onBeforeTryTask?: (test: TaskPopulated, options: { retry: number; repeats: number }) => unknown
  /**
   * Called after result and state are set.
   */
  onAfterRunTask?: (test: TaskPopulated) => unknown
  /**
   * Called right after running the test function. Doesn't have new state yet. Will not be called, if the test function throws.
   */
  onAfterTryTask?: (test: TaskPopulated, options: { retry: number; repeats: number }) => unknown

  /**
   * Called before running a single suite. Doesn't have "result" yet.
   */
  onBeforeRunSuite?: (suite: Suite) => unknown
  /**
   * Called after running a single suite. Has state and result.
   */
  onAfterRunSuite?: (suite: Suite) => unknown

  /**
   * If defined, will be called instead of usual Vitest suite partition and handling.
   * "before" and "after" hooks will not be ignored.
   */
  runSuite?: (suite: Suite) => Promise<void>
  /**
   * If defined, will be called instead of usual Vitest handling. Useful, if you have your custom test function.
   * "before" and "after" hooks will not be ignored.
   */
  runTask?: (test: TaskPopulated) => Promise<void>

  /**
   * Called, when a task is updated. The same as "onTaskUpdate" in a reporter, but this is running in the same thread as tests.
   */
  onTaskUpdate?: (task: [string, TaskResult | undefined, TaskMeta | undefined][]) => Promise<void>

  /**
   * Called before running all tests in collected paths.
   */
  onBeforeRunFiles?: (files: File[]) => unknown
  /**
   * Called right after running all tests in collected paths.
   */
  onAfterRunFiles?: (files: File[]) => unknown
  /**
   * Called when new context for a test is defined. Useful, if you want to add custom properties to the context.
   * If you only want to define custom context with a runner, consider using "beforeAll" in "setupFiles" instead.
   */
  extendTaskContext?: (context: TestContext) => TestContext
  /**
   * Called when certain files are imported. Can be called in two situations: to collect tests and to import setup files.
   */
  importFile: (filepath: string, source: VitestRunnerImportSource) => unknown
  /**
   * Function that is called when the runner attempts to get the value when `test.extend` is used with `{ injected: true }`
   */
  injectValue?: (key: string) => unknown
  /**
   * Publicly available configuration.
   */
  config: VitestRunnerConfig
  /**
   * The name of the current pool. Can affect how stack trace is inferred on the server side.
   */
  pool?: string
}
```

When initiating this class, Vitest passes down Vitest config, - you should expose it as a `config` property:

```ts [runner.ts]
import type { RunnerTestFile } from 'vitest'
import type { VitestRunner, VitestRunnerConfig } from 'vitest/suite'
import { VitestTestRunner } from 'vitest/runners'

class CustomRunner extends VitestTestRunner implements VitestRunner {
  public config: VitestRunnerConfig

  constructor(config: VitestRunnerConfig) {
    this.config = config
  }

  onAfterRunFiles(files: RunnerTestFile[]) {
    console.log('finished running', files)
  }
}

export default CustomRunner
```

::: warning
Vitest also injects an instance of `ViteNodeRunner` as `__vitest_executor` property. You can use it to process files in `importFile` method (this is default behavior of `TestRunner` and `BenchmarkRunner`).

`ViteNodeRunner` exposes `executeId` method, which is used to import test files in a Vite-friendly environment. Meaning, it will resolve imports and transform file content at runtime so that Node can understand it:

```ts
export default class Runner {
  async importFile(filepath: string) {
    await this.__vitest_executor.executeId(filepath)
  }
}
```
:::

::: warning
If you don't have a custom runner or didn't define `runTest` method, Vitest will try to retrieve a task automatically. If you didn't add a function with `setFn`, it will fail.
:::

::: tip
Snapshot support and some other features depend on the runner. If you don't want to lose it, you can extend your runner from `VitestTestRunner` imported from `vitest/runners`. It also exposes `BenchmarkNodeRunner`, if you want to extend benchmark functionality.
:::

## Tasks

::: warning
The "Runner Tasks API" is experimental and should primarily be used only in the test runtime. Vitest also exposes the ["Reported Tasks API"](/advanced/api/test-module), which should be preferred when working in the main thread (inside the reporter, for example).

The team is currently discussing if "Runner Tasks" should be replaced by "Reported Tasks" in the future.
:::

Suites and tests are called `tasks` internally. Vitest runner initiates a `File` task before collecting any tests - this is a superset of `Suite` with a few additional properties. It is available on every task (including `File`) as a `file` property.

```ts
interface File extends Suite {
  /**
   * The name of the pool that the file belongs to.
   * @default 'forks'
   */
  pool?: string
  /**
   * The path to the file in UNIX format.
   */
  filepath: string
  /**
   * The name of the workspace project the file belongs to.
   */
  projectName: string | undefined
  /**
   * The time it took to collect all tests in the file.
   * This time also includes importing all the file dependencies.
   */
  collectDuration?: number
  /**
   * The time it took to import the setup file.
   */
  setupDuration?: number
}
```

Every suite has a `tasks` property that is populated during collection phase. It is useful to traverse the task tree from the top down.

```ts
interface Suite extends TaskBase {
  type: 'suite'
  /**
   * File task. It's the root task of the file.
   */
  file: File
  /**
   * An array of tasks that are part of the suite.
   */
  tasks: Task[]
}
```

Every task has a `suite` property that references a suite it is located in. If `test` or `describe` are initiated at the top level, they will not have a `suite` property (it will **not** be equal to `file`!). `File` also never has a `suite` property. It is useful to travers the tasks from the bottom up.

```ts
interface Test<ExtraContext = object> extends TaskBase {
  type: 'test'
  /**
   * Test context that will be passed to the test function.
   */
  context: TestContext & ExtraContext
  /**
   * File task. It's the root task of the file.
   */
  file: File
  /**
   * Whether the task was skipped by calling `t.skip()`.
   */
  pending?: boolean
  /**
   * Whether the task should succeed if it fails. If the task fails, it will be marked as passed.
   */
  fails?: boolean
  /**
   * Store promises (from async expects) to wait for them before finishing the test
   */
  promises?: Promise<any>[]
}
```

Every task can have a `result` field. Suites can only have this field if an error thrown within a suite callback or `beforeAll`/`afterAll` callbacks prevents them from collecting tests. Tests always have this field after their callbacks are called - the `state` and `errors` fields are present depending on the outcome. If an error was thrown in `beforeEach` or `afterEach` callbacks, the thrown error will be present in `task.result.errors`.

```ts
export interface TaskResult {
  /**
   * State of the task. Inherits the `task.mode` during collection.
   * When the task has finished, it will be changed to `pass` or `fail`.
   * - **pass**: task ran successfully
   * - **fail**: task failed
   */
  state: TaskState
  /**
   * Errors that occurred during the task execution. It is possible to have several errors
   * if `expect.soft()` failed multiple times.
   */
  errors?: ErrorWithDiff[]
  /**
   * How long in milliseconds the task took to run.
   */
  duration?: number
  /**
   * Time in milliseconds when the task started running.
   */
  startTime?: number
  /**
   * Heap size in bytes after the task finished.
   * Only available if `logHeapUsage` option is set and `process.memoryUsage` is defined.
   */
  heap?: number
  /**
   * State of related to this task hooks. Useful during reporting.
   */
  hooks?: Partial<Record<'afterAll' | 'beforeAll' | 'beforeEach' | 'afterEach', TaskState>>
  /**
   * The amount of times the task was retried. The task is retried only if it
   * failed and `retry` option is set.
   */
  retryCount?: number
  /**
   * The amount of times the task was repeated. The task is repeated only if
   * `repeats` option is set. This number also contains `retryCount`.
   */
  repeatCount?: number
}
```

## Your Task Function

Vitest exposes `createTaskCollector` utility to create your own `test` method. It behaves the same way as a test, but calls a custom method during collection.

A task is an object that is part of a suite. It is automatically added to the current suite with a `suite.task` method:

```js [custom.js]
import { createTaskCollector, getCurrentSuite } from 'vitest/suite'

export { afterAll, beforeAll, describe } from 'vitest'

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

```js [tasks.test.js]
import {
  afterAll,
  beforeAll,
  describe,
  myCustomTask
} from './custom.js'
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
