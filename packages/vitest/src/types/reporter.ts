import type { Vitest } from '../node'
import type { Awaitable, UserConsoleLog } from './general'
import type { File, TaskResultPack } from './tasks'

export interface Reporter {
  onInit?(ctx: Vitest): void
  onCollected?: (files?: File[]) => void
  onFinished?: (files?: File[]) => Awaitable<void>
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>

  onWatcherStart?: () => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger?: string) => Awaitable<void>

  onServerRestart?: () => Awaitable<void>

  onUserConsoleLog?: (log: UserConsoleLog) => void
}
