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
   * Called before running a single test. Doesn't have "result" yet.
   */
  onBeforeRunTest?(test: Test): unknown
  /**
   * Called before actually running the test function. Already has "result" with "state" and "startTime".
   */
  onBeforeTryTest?(test: Test, retryCount: number): unknown
  /**
   * Called after result and state are set.
   */
  onAfterRunTest?(test: Test): unknown
  /**
   * Called right after running the test function. Doesn't have new state yet. Will not be called, if the test function throws.
   */
  onAfterTryTest?(test: Test, retryCount: number): unknown

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
  runTest?(test: Test): Promise<void>

  /**
   * Called, when a task is updated. The same as "onTaskUpdate" in a reporter, but this is running in the same thread as tests.
   */
  onTaskUpdate?(task: [string, TaskResult | undefined][]): Promise<void>

  /**
   * Called before running all tests in collected paths.
   */
  onBeforeRun?(files: File[]): unknown
  /**
   * Called right after running all tests in collected paths.
   */
  onAfterRun?(files: File[]): unknown
  /**
   * Called when new context for a test is defined. Useful, if you want to add custom properties to the context.
   * If you only want to define custom context with a runner, consider using "beforeAll" in "setupFiles" instead.
   */
  extendTestContext?(context: TestContext): TestContext
  /**
   * Called, when files are imported. Can be called in two situations: when collecting tests and when importing setup files.
   */
  importFile(filepath: string, source: VitestRunnerImportSource): unknown
  /**
   * Publically available configuration.
   */
  config: VitestRunnerConfig
}
```

When initiating this class, Vitest passes down Vitest config, - you should expose it as a `config` property.

::: warning
`importFile` method in your custom runner must be inlined in `deps.inline` config option, if you call Node `import` inside.
:::

::: tip
Snapshot support, C8 coverage, and some other features depend on the runner. If you don't want to lose it, you can extend your runner from `VitestTestRunner` imported from `vitest/runners`. It also exposes `BenchmarkNodeRunner`, if you want to extend its functionality.
:::