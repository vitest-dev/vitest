# Extending Reporters

You can import reporters from `vitest/reporters` and extend them to create your custom reporters.

## Extending Built-in Reporters

In general, you don't need to create your reporter from scratch. `vitest` comes with several default reporting programs that you can extend.

```ts
import { DefaultReporter } from 'vitest/reporters'

export default class MyDefaultReporter extends DefaultReporter {
  // do something
}
```

Of course, you can create your reporter from scratch. Just extend the `BaseReporter` class and implement the methods you need.

And here is an example of a custom reporter:

```ts
// ./custom-reporter.js
import { BaseReporter } from 'vitest/reporters'

export default class CustomReporter extends BaseReporter {
  onCollected() {
    const files = this.ctx.state.getFiles(this.watchFilters)
    this.reportTestSummary(files)
  }
}
```

Or implement the `Reporter` interface:

```ts
// ./custom-reporter.js
import { Reporter } from 'vitest/reporters'

export default class CustomReporter implements Reporter {
  onCollected() {
    // print something
  }
}
```

Then you can use your custom reporter in the `vitest.config.ts` file:

```ts
import { defineConfig } from 'vitest/config'
import CustomReporter from './custom-reporter.js'

export default defineConfig({
  test: {
    reporters: [new CustomReporter()],
  },
})
```

## Reported Tasks

::: warning
This is an experimental API. Breaking changes might not follow SemVer. Please pin Vitest's version when using it.

You can get access to this API by calling `vitest.state.getReportedEntity(runnerTask)`:

```ts twoslash
import type { Vitest } from 'vitest/node'
import type { RunnerTestFile } from 'vitest'
import type { Reporter, TestModule } from 'vitest/reporters'

class MyReporter implements Reporter {
  ctx!: Vitest

  onInit(ctx: Vitest) {
    this.ctx = ctx
  }

  onFinished(files: RunnerTestFile[]) {
    for (const fileTask of files) {
      // note that the old task implementation uses "file" instead of "module"
      const testModule = this.ctx.state.getReportedEntity(fileTask) as TestModule
      for (const task of testModule.children) {
        //                          ^?
        console.log('finished', task.type, task.fullName)
      }
    }
  }
}
```

We are planning to stabilize this API in Vitest 2.1.
:::

### TestCase

`TestCase` represents a single test.

```ts
declare class TestCase {
  readonly type = 'test' | 'custom'
  /**
   * Task instance.
   * @experimental Public task API is experimental and does not follow semver.
   */
  readonly task: RunnerTestCase | RunnerCustomCase
  /**
   * The project associated with the test.
   */
  readonly project: TestProject
  /**
   * Direct reference to the test module where the test is defined.
   */
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

### TestSuite

`TestSuite` represents a single suite that contains tests and other suites.

```ts
declare class TestSuite {
  readonly type = 'suite'
  /**
   * Task instance.
   * @experimental Public task API is experimental and does not follow semver.
   */
  readonly task: RunnerTestSuite
  /**
   * The project associated with the test.
   */
  readonly project: TestProject
  /**
   * Direct reference to the test module where the suite is defined.
   */
  readonly module: TestModule
  /**
   * Name of the suite.
   */
  readonly name: string
  /**
   * Full name of the suite including all parent suites separated with `>`.
   */
  readonly fullName: string
  /**
   * Unique identifier.
   * This ID is deterministic and will be the same for the same test across multiple runs.
   * The ID is based on the project name, module id and test position.
   */
  readonly id: string
  /**
   * Location in the module where the suite was defined.
   * Locations are collected only if `includeTaskLocation` is enabled in the config.
   */
  readonly location: { line: number; column: number } | undefined
  /**
   * Collection of suites and tests that are part of this suite.
   */
  readonly children: TaskCollection
  /**
   * Options that the suite was initiated with.
   */
  readonly options: TaskOptions
}
```

### TestModule

`TestModule` represents a single file that contains suites and tests.

```ts
declare class TestModule extends SuiteImplementation {
  readonly type = 'module'
  /**
   * Task instance.
   * @experimental Public task API is experimental and does not follow semver.
   */
  readonly task: RunnerTestFile
  /**
   * Collection of suites and tests that are part of this module.
   */
  readonly children: TestCollection
  /**
   * This is usually an absolute Unix file path.
   * It can be a virtual id if the file is not on the disk.
   * This value corresponds to Vite's `ModuleGraph` id.
   */
  readonly moduleId: string
  /**
   * Useful information about the module like duration, memory usage, etc.
   * If the module was not executed yet, all diagnostic values will return `0`.
   */
  diagnostic(): ModuleDiagnostic
}

export interface ModuleDiagnostic {
  /**
   * The time it takes to import and initiate an environment.
   */
  environmentSetupDuration: number
  /**
   * The time it takes Vitest to setup test harness (runner, mocks, etc.).
   */
  prepareDuration: number
  /**
   * The time it takes to import the test module.
   * This includes importing everything in the module and executing suite callbacks.
   */
  collectDuration: number
  /**
   * The time it takes to import the setup module.
   */
  setupDuration: number
  /**
   * Accumulated duration of all tests and hooks in the module.
   */
  duration: number
}
```

### TestCollection

`TestCollection` represents a collection of suites and tests. It also provides useful methods to iterate over itself.

```ts
declare class TestCollection {
  /**
   * Returns the test or suite at a specific index in the array.
   */
  at(index: number): TestCase | TestSuite | undefined
  /**
   * The number of tests and suites in the collection.
   */
  size: number
  /**
   * Returns the collection in array form for easier manipulation.
   */
  array(): (TestCase | TestSuite)[]
  /**
   * Filters all suites that are part of this collection and its children.
   */
  allSuites(): IterableIterator<TestSuite>
  /**
   * Filters all tests that are part of this collection and its children.
   */
  allTests(state?: TestResult['state'] | 'running'): IterableIterator<TestCase>
  /**
   * Filters only the tests that are part of this collection.
   */
  tests(state?: TestResult['state'] | 'running'): IterableIterator<TestCase>
  /**
   * Filters only the suites that are part of this collection.
   */
  suites(): IterableIterator<TestSuite>;
  [Symbol.iterator](): IterableIterator<TestSuite | TestCase>
}
```

For example, you can iterate over all tests inside a module by calling `testModule.children.allTests()`:

```ts
function onFileCollected(testModule: TestModule): void {
  console.log('collecting tests in', testModule.moduleId)

  // iterate over all tests and suites in the module
  for (const task of testModule.children.allTests()) {
    console.log('collected', task.type, task.fullName)
  }
}
```

### TestProject

`TestProject` is a project assosiated with the module. Every test and suite inside that module will reference the same project.

Project is useful to get the configuration or provided context.

```ts
declare class TestProject {
  /**
   * The global vitest instance.
   * @experimental The public Vitest API is experimental and does not follow semver.
   */
  readonly vitest: Vitest
  /**
   * The workspace project this test project is associated with.
   * @experimental The public Vitest API is experimental and does not follow semver.
   */
  readonly workspaceProject: WorkspaceProject
  /**
   * Resolved project configuration.
   */
  readonly config: ResolvedProjectConfig
  /**
   * Resolved global configuration. If there are no workspace projects, this will be the same as `config`.
   */
  readonly globalConfig: ResolvedConfig
  /**
   * Serialized project configuration. This is the config that tests receive.
   */
  get serializedConfig(): SerializedConfig
  /**
   * The name of the project or an empty string if not set.
   */
  name(): string
  /**
   * Custom context provided to the project.
   */
  context(): ProvidedContext
  /**
   * Provide a custom serializable context to the project. This context will be available for tests once they run.
   */
  provide<T extends keyof ProvidedContext & string>(key: T, value: ProvidedContext[T]): void
}
```

## Exported Reporters

`vitest` comes with a few [built-in reporters](/guide/reporters) that you can use out of the box.

### Built-in reporters:

1. `BasicReporter`
1. `DefaultReporter`
2. `DotReporter`
3. `JsonReporter`
4. `VerboseReporter`
5. `TapReporter`
6. `JUnitReporter`
7. `TapFlatReporter`
8. `HangingProcessReporter`

### Base Abstract reporters:

1. `BaseReporter`

### Interface reporters:

1. `Reporter`
