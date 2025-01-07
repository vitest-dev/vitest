import type { File, TaskResultPack } from '@vitest/runner'
import type { SerializedError } from '@vitest/utils'
import type { SerializedTestSpecification } from '../../runtime/types/utils'
import type { Awaitable, UserConsoleLog } from '../../types/general'
import type { Vitest } from '../core'
import type { HookOptions, TestCase, TestModule } from '../reporters/reported-tasks'
import type { TestSpecification } from '../spec'

export interface Reporter {
  onInit?: (ctx: Vitest) => void
  /**
   * @deprecated use `onTestRunStart` instead
   */
  onPathsCollected?: (paths?: string[]) => Awaitable<void>
  /**
   * @deprecated use `onTestRunStart` instead
   */
  onSpecsCollected?: (specs?: SerializedTestSpecification[]) => Awaitable<void>
  // TODO: deprecate instead of what(?)
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
   * @deprecated use `onTestModuleQueued`, `onTestModuleStart`, `onTestModuleEnd`, `onTestCaseStart`, `onTestCaseEnd` instead
   */
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>
  onTestRemoved?: (trigger?: string) => Awaitable<void>
  onWatcherStart?: (files?: File[], errors?: unknown[]) => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger?: string) => Awaitable<void>
  onServerRestart?: (reason?: string) => Awaitable<void>
  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
  onProcessTimeout?: () => Awaitable<void>

  // new API, TODO: add a lot of documentation for those
  /**
   * Called when the new test run starts.
   */
  onTestRunStart?: (specifications: TestSpecification[]) => Awaitable<void>
  /**
   * Called when the test run is finished.
   */
  onTestRunEnd?: (
    testModules: TestModule[],
    errors: SerializedError[],
    reason: 'passed' | 'interrupted' | 'failed'
  ) => Awaitable<void>
  /**
   * Called when the module is enqueued for testing. The file itself is not loaded yet.
   */
  onTestModuleQueued?: (testModule: TestModule) => Awaitable<void>
  /**
   * Called when the test file is loaded and the module is ready to run tests.
   */
  onTestModuleCollected?: (testModule: TestModule) => Awaitable<void>
  onTestModuleStart?: (testModule: TestModule) => Awaitable<void>
  onTestModuleEnd?: (testModule: TestModule) => Awaitable<void>

  /**
   * Called before the `beforeEach` hooks for the test are run.
   * The `result()` will return either `pending` or `skipped`.
   */
  onTestCaseStart?: (testCase: TestCase) => Awaitable<void>
  /**
   * Called after the test and its hooks are finished running.
   * The `result()` cannot be `pending`.
   */
  onTestCaseEnd?: (testCase: TestCase) => Awaitable<void>

  onHookStart?: (hook: HookOptions) => Awaitable<void>
  onHookEnd?: (hook: HookOptions) => Awaitable<void>

  onCoverage?: (coverage: unknown) => Awaitable<void>
}
