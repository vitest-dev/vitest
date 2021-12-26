import type { MessagePort } from 'worker_threads'
import type { RawSourceMap } from 'source-map-js'
import type { ResolvedConfig } from './config'
import type { File, TaskResultPack } from './tasks'
import type { SnapshotResult } from './snapshot'
import type { UserConsoleLog } from './general'

export interface WorkerContext {
  port: MessagePort
  config: ResolvedConfig
  files: string[]
  invalidates?: string[]
}

export interface WorkerRPC {
  fetch: (id: string) => Promise<string | undefined>
  getSourceMap: (id: string, force?: boolean) => Promise<RawSourceMap | undefined>

  onWorkerExit: (code?: number) => void
  onUserLog: (log: UserConsoleLog) => void
  onCollected: (files: File[]) => void
  onTaskUpdate: (pack: TaskResultPack) => void

  snapshotSaved: (snapshot: SnapshotResult) => void
}
