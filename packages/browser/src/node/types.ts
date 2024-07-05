import type { BirpcReturn } from 'birpc'
import type { AfterSuiteRunMeta, CancelReason, File, Reporter, SnapshotResult, TaskResultPack, UserConsoleLog } from 'vitest'

export interface WebSocketBrowserHandlers {
  resolveSnapshotPath: (testPath: string) => string
  resolveSnapshotRawPath: (testPath: string, rawPath: string) => string
  onUnhandledError: (error: unknown, type: string) => Promise<void>
  onCollected: (files?: File[]) => Promise<void>
  onTaskUpdate: (packs: TaskResultPack[]) => void
  onAfterSuiteRun: (meta: AfterSuiteRunMeta) => void
  onCancel: (reason: CancelReason) => void
  getCountOfFailedTests: () => number
  readSnapshotFile: (id: string) => Promise<string | null>
  saveSnapshotFile: (id: string, content: string) => Promise<void>
  removeSnapshotFile: (id: string) => Promise<void>
  sendLog: (log: UserConsoleLog) => void
  finishBrowserTests: (contextId: string) => void
  snapshotSaved: (snapshot: SnapshotResult) => void
  debug: (...args: string[]) => void
  resolveId: (
    id: string,
    importer?: string
  ) => Promise<{ id: string } | null>
  triggerCommand: <T>(
    contextId: string,
    command: string,
    testPath: string | undefined,
    payload: unknown[]
  ) => Promise<T>
  resolveMock: (
    id: string,
    importer: string,
    hasFactory: boolean
  ) => Promise<{
    type: 'factory' | 'redirect' | 'automock'
    mockPath?: string | null
    resolvedId: string
    needsInterop?: boolean
  }>
  invalidate: (ids: string[]) => void
  getBrowserFileSourceMap: (
    id: string
  ) => SourceMap | null | { mappings: '' } | undefined

  // cdp
  sendCdpEvent: (contextId: string, event: string, payload?: Record<string, unknown>) => unknown
  trackCdpEvent: (contextId: string, type: 'on' | 'once' | 'off', event: string, listenerId: string) => void
}

export interface WebSocketEvents
  extends Pick<
    Reporter,
    | 'onCollected'
    | 'onFinished'
    | 'onTaskUpdate'
    | 'onUserConsoleLog'
    | 'onPathsCollected'
    | 'onSpecsCollected'
  > {
  onFinishedReportCoverage: () => void
}

export interface WebSocketBrowserEvents {
  onCancel: (reason: CancelReason) => void
  createTesters: (files: string[]) => Promise<void>
  cdpEvent: (event: string, payload: unknown) => void
}

export type WebSocketBrowserRPC = BirpcReturn<
  WebSocketBrowserEvents,
  WebSocketBrowserHandlers
>

interface SourceMap {
  file: string
  mappings: string
  names: string[]
  sources: string[]
  sourcesContent?: string[]
  version: number
  toString: () => string
  toUrl: () => string
}
