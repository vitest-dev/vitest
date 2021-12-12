import type { Awaitable } from './general'
import type { File, TaskResultPack } from './tasks'

export interface Reporter {
  onStart?: (files?: string[]) => Awaitable<void>
  onFinished?: (files?: File[]) => Awaitable<void>
  onTaskUpdate?: (pack: TaskResultPack) => Awaitable<void>

  onWatcherStart?: () => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger: string) => Awaitable<void>
}
