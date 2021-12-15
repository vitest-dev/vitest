import type { MessagePort } from 'worker_threads'
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

export interface RpcMap {
  fetch: [[id: string], string | undefined]
  log: [[UserConsoleLog], void]
  processExit: [[code?: number], void]

  onCollected: [[files: File[]], void]
  onFinished: [[], void]
  onTaskUpdate: [[pack: TaskResultPack], void]

  onWatcherStart: [[], void]
  onWatcherRerun: [[files: string[], trigger: string], void]

  snapshotSaved: [[snapshot: SnapshotResult], void]
}

export type RpcCall = <T extends keyof RpcMap>(method: T, ...args: RpcMap[T][0]) => Promise<RpcMap[T][1]>
export type RpcSend = <T extends keyof RpcMap>(method: T, ...args: RpcMap[T][0]) => void

export type RpcPayload<T extends keyof RpcMap = keyof RpcMap> = { id: string; method: T; args: RpcMap[T][0]}
