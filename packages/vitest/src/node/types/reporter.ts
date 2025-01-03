import type { File, TaskResultPack } from '@vitest/runner'
import type { SerializedError } from '@vitest/utils'
import type { SerializedTestSpecification } from '../../runtime/types/utils'
import type { Awaitable, UserConsoleLog } from '../../types/general'
import type { Vitest } from '../core'
import type { TestCase, TestModule } from '../reporters/reported-tasks'
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
   * @deprecated use `onTestModuleQueued`, `onTestModulePrepare`, `onTestModuleFinished`, `onTestCasePrepare`, `onTestCaseFinished` instead
   */
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>
  onTestRemoved?: (trigger?: string) => Awaitable<void>
  onWatcherStart?: (files?: File[], errors?: unknown[]) => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger?: string) => Awaitable<void>
  onServerRestart?: (reason?: string) => Awaitable<void>
  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
  onProcessTimeout?: () => Awaitable<void>

  // new API
  onTestRunStart?: (specifications: TestSpecification[]) => Awaitable<void>
  onTestRunEnd?: (
    testModules: TestModule[],
    errors: SerializedError[],
    reason: 'passed' | 'interrupted' | 'failed'
  ) => Awaitable<void>
  onTestModuleQueued?: (testModule: TestModule) => Awaitable<void>
  onTestModulePrepare?: (testModule: TestModule) => Awaitable<void>
  onTestModuleFinished?: (testModule: TestModule) => Awaitable<void>

  // TODO: This was planned as onTestFinished, but maybe we could use TestCase in name directly?
  onTestCasePrepare?: (testCase: TestCase) => Awaitable<void>
  onTestCaseFinished?: (testCase: TestCase) => Awaitable<void>
}
