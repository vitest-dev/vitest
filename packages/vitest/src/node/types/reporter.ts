import type { File, TaskResultPack } from '@vitest/runner'
import type { SerializedError } from '@vitest/utils'
import type { SerializedTestSpecification } from '../../runtime/types/utils'
import type { Awaitable, UserConsoleLog } from '../../types/general'
import type { Vitest } from '../core'
import type { TestProject } from '../project'
import type { ReportedHookContext, TestCase, TestModule, TestSuite } from '../reporters/reported-tasks'
import type { TestSpecification } from '../spec'

export type TestRunEndReason = 'passed' | 'interrupted' | 'failed'

export interface Reporter {
  onInit?: (vitest: Vitest) => void
  /**
   * Called when the project initiated the browser instance.
   * project.browser will always be defined.
   * @experimental
   */
  onBrowserInit?: (project: TestProject) => Awaitable<void>
  /**
   * @deprecated use `onTestRunStart` instead
   */
  onPathsCollected?: (paths?: string[]) => Awaitable<void>
  /**
   * @deprecated use `onTestRunStart` instead
   */
  onSpecsCollected?: (specs?: SerializedTestSpecification[]) => Awaitable<void>
  /**
   * @deprecated use `onTestModuleCollected` instead
   */
  onCollected?: (files: File[]) => Awaitable<void>
  /**
   * @deprecated use `onTestRunEnd` instead
   */
  onFinished?: (
    files: File[],
    errors: unknown[],
    coverage?: unknown
  ) => Awaitable<void>
  /**
   * @deprecated use `onTestModuleQueued`, `onTestModuleStart`, `onTestModuleEnd`, `onTestCaseReady`, `onTestCaseResult` instead
   */
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>
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
    reason: TestRunEndReason
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
