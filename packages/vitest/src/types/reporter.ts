import type { Vitest } from '../node'
import type { Awaitable, UserConsoleLog } from './general'
import type { File, TaskResultPack } from './tasks'

export interface Reporter {
  onInit?(ctx: Vitest): void
  onStart?: (files?: string[]) => Awaitable<void>
  onFinished?: (files?: File[]) => Awaitable<void>
  onTaskUpdate?: (pack: TaskResultPack) => Awaitable<void>

  onWatcherStart?: () => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger: string) => Awaitable<void>

  onServerRestart?: () => Awaitable<void>

  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
}
