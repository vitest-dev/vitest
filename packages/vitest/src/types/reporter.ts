import type { Vitest } from '../node'
import type { Awaitable, UserConsoleLog } from './general'
import type { File, TaskResultPack } from './tasks'

export interface Reporter {
  onInit?(ctx: Vitest): void
  onPathsCollected?: (paths?: string[]) => Awaitable<void>
  onCollected?: (files?: File[]) => Awaitable<void>
  onFinished?: (files?: File[], errors?: unknown[]) => Awaitable<void>
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>

  onTestRemoved?: (trigger?: string) => Awaitable<void>
  onWatcherStart?: (files?: File[], errors?: unknown[]) => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger?: string) => Awaitable<void>

  onServerRestart?: (reason?: string) => Awaitable<void>

  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
}

export type { Vitest }
