import type { File, TaskResultPack } from '@vitest/runner'
import type { SerializedTestSpecification } from '../../runtime/types/utils'
import type { Awaitable, UserConsoleLog } from '../../types/general'
import type { Vitest } from '../core'
import type { TestModule } from '../reporters/reported-tasks'

export interface Reporter {
  onInit?: (ctx: Vitest) => void
  onPathsCollected?: (paths?: string[]) => Awaitable<void>
  onSpecsCollected?: (specs?: SerializedTestSpecification[]) => Awaitable<void>
  onTestModuleQueued?: (file: TestModule) => Awaitable<void>
  onCollected?: (files?: File[]) => Awaitable<void>
  onFinished?: (
    files: File[],
    errors: unknown[],
    coverage?: unknown
  ) => Awaitable<void>
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>
  onTestRemoved?: (trigger?: string) => Awaitable<void>
  onWatcherStart?: (files?: File[], errors?: unknown[]) => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger?: string) => Awaitable<void>
  onServerRestart?: (reason?: string) => Awaitable<void>
  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
  onProcessTimeout?: () => Awaitable<void>
}
