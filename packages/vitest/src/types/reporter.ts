import type { Vitest } from '../node'
import type { Awaitable, UserConsoleLog } from './general'
import type { File, TaskResultPack } from './tasks'

export interface Reporter {
  onInit?(ctx: Vitest): void
  onCollected?: (files?: File[]) => Awaitable<void>
  onFinished?: (files?: File[], errors?: unknown[]) => Awaitable<void>
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>

  onTestRemoved?: (trigger?: string) => Awaitable<void>
  onWatcherStart?: () => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger?: string) => Awaitable<void>

  onServerRestart?: () => Awaitable<void>

  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
}

export type { Vitest }
