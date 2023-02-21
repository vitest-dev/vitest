import type { File, SequenceHooks, Suite, TaskResult, Test, TestContext } from './tasks'

export interface VitestRunnerConfig {
  root: string
  setupFiles: string[] | string
  name: string
  passWithNoTests: boolean
  testNamePattern?: RegExp
  allowOnly?: boolean
  sequence: {
    shuffle?: boolean
    seed: number
    hooks: SequenceHooks
  }
  maxConcurrency: number
  testTimeout: number
  hookTimeout: number
}

export type VitestRunnerImportSource = 'collect' | 'setup'

export interface VitestRunnerConstructor {
  new (config: VitestRunnerConfig): VitestRunner
}

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
   * If you only want to define custom context, consider using "beforeAll" in "setupFiles" instead.
   */
  extendTestContext?(context: TestContext): TestContext
  /**
   * Called, when files are imported. Can be called in two situations: when collecting tests and when importing setup files.
   */
  importFile(filepath: string, source: VitestRunnerImportSource): unknown
  /**
   * Publicly available configuration.
   */
  config: VitestRunnerConfig
}
