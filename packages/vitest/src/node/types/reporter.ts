import type { File, TaskEventPack, TaskResultPack, TestAnnotation, TestArtifact } from '@vitest/runner'
import type { Awaitable, SerializedError } from '@vitest/utils'
import type { UserConsoleLog } from '../../types/general'
import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { ReportedHookContext, TestCase, TestModule, TestSuite } from '../reporters/reported-tasks'
import type { TestSpecification } from '../test-specification'

export type TestRunEndReason = 'passed' | 'interrupted' | 'failed'

export interface Reporter {
  onInit?: (vitest: Vitest) => void
  /**
   * Called when the project initiated the browser instance.
   * project.browser will always be defined.
   */
  onBrowserInit?: (project: TestProject) => Awaitable<void>
  /** @internal   */
  onTaskUpdate?: (packs: TaskResultPack[], events: TaskEventPack[]) => Awaitable<void>
  onTestRemoved?: (trigger?: string) => Awaitable<void>
  onWatcherStart?: (files?: File[], errors?: unknown[]) => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger?: string) => Awaitable<void>
  onServerRestart?: (reason?: string) => Awaitable<void>
  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
  onProcessTimeout?: () => Awaitable<void>

  /**
   * Called when the new test run starts.
   */
  onTestRunStart?: (specifications: ReadonlyArray<TestSpecification>) => Awaitable<void>
  /**
   * Called when the test run is finished.
   */
  onTestRunEnd?: (
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    reason: TestRunEndReason,
  ) => Awaitable<void>

  /**
   * Called when the module is enqueued for testing. The file itself is not loaded yet.
   */
  onTestModuleQueued?: (testModule: TestModule) => Awaitable<void>
  /**
   * Called when the test file is loaded and the module is ready to run tests.
   */
  onTestModuleCollected?: (testModule: TestModule) => Awaitable<void>
  /**
   * Called when starting to run tests of the test file
   */
  onTestModuleStart?: (testModule: TestModule) => Awaitable<void>
  /**
   * Called when all tests of the test file have finished running.
   */
  onTestModuleEnd?: (testModule: TestModule) => Awaitable<void>

  /**
   * Called when test case is ready to run.
   * Called before the `beforeEach` hooks for the test are run.
   */
  onTestCaseReady?: (testCase: TestCase) => Awaitable<void>
  /**
   * Called after the test and its hooks are finished running.
   * The `result()` cannot be `pending`.
   */
  onTestCaseResult?: (testCase: TestCase) => Awaitable<void>

  /**
   * Called when annotation is added via the `task.annotate` API.
   */
  onTestCaseAnnotate?: (testCase: TestCase, annotation: TestAnnotation) => Awaitable<void>

  /**
   * Called when artifacts are recorded on tests via the `recordArtifact` utility.
   */
  onTestCaseArtifactRecord?: (testCase: TestCase, artifact: TestArtifact) => Awaitable<void>

  /**
   * Called when test suite is ready to run.
   * Called before the `beforeAll` hooks for the test are run.
   */
  onTestSuiteReady?: (testSuite: TestSuite) => Awaitable<void>
  /**
   * Called after the test suite and its hooks are finished running.
   * The `state` cannot be `pending`.
   */
  onTestSuiteResult?: (testSuite: TestSuite) => Awaitable<void>

  /**
   * Called before the hook starts to run.
   */
  onHookStart?: (hook: ReportedHookContext) => Awaitable<void>
  /**
   * Called after the hook finished running.
   */
  onHookEnd?: (hook: ReportedHookContext) => Awaitable<void>

  onCoverage?: (coverage: unknown) => Awaitable<void>
}
