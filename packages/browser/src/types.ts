import type { ServerIdResolution, ServerMockResolution } from '@vitest/mocker'
import type { TaskEventPack, TaskResultPack } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type {
  AfterSuiteRunMeta,
  CancelReason,
  RunnerTestFile,
  SerializedTestSpecification,
  SnapshotResult,
  UserConsoleLog,
} from 'vitest'

export interface WebSocketBrowserHandlers {
  resolveSnapshotPath: (testPath: string) => string
  resolveSnapshotRawPath: (testPath: string, rawPath: string) => string
  onUnhandledError: (error: unknown, type: string) => Promise<void>
  onQueued: (file: RunnerTestFile) => void
  onCollected: (files: RunnerTestFile[]) => Promise<void>
  onTaskUpdate: (packs: TaskResultPack[], events: TaskEventPack[]) => void
  onAfterSuiteRun: (meta: AfterSuiteRunMeta) => void
  onCancel: (reason: CancelReason) => void
  getCountOfFailedTests: () => number
  readSnapshotFile: (id: string) => Promise<string | null>
  saveSnapshotFile: (id: string, content: string) => Promise<void>
  removeSnapshotFile: (id: string) => Promise<void>
  sendLog: (log: UserConsoleLog) => void
  finishBrowserTests: (sessionId: string) => void
  snapshotSaved: (snapshot: SnapshotResult) => void
  debug: (...args: string[]) => void
  resolveId: (
    id: string,
    importer?: string
  ) => Promise<ServerIdResolution | null>
  triggerCommand: <T>(
    sessionId: string,
    command: string,
    testPath: string | undefined,
    payload: unknown[]
  ) => Promise<T>
  resolveMock: (
    id: string,
    importer: string,
    options: { mock: 'spy' | 'factory' | 'auto' },
  ) => Promise<ServerMockResolution>
  invalidate: (ids: string[]) => void
  getBrowserFileSourceMap: (
    id: string
  ) => SourceMap | null | { mappings: '' } | undefined
  wdioSwitchContext: (direction: 'iframe' | 'parent') => void

  // cdp
  sendCdpEvent: (sessionId: string, event: string, payload?: Record<string, unknown>) => unknown
  trackCdpEvent: (sessionId: string, type: 'on' | 'once' | 'off', event: string, listenerId: string) => void
}

export type Awaitable<T> = T | PromiseLike<T>

export interface WebSocketEvents {
  onCollected?: (files: RunnerTestFile[]) => Awaitable<void>
  onFinished?: (
    files: File[],
    errors: unknown[],
    coverage?: unknown
  ) => Awaitable<void>
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>
  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
  onPathsCollected?: (paths?: string[]) => Awaitable<void>
  onSpecsCollected?: (specs?: SerializedTestSpecification[]) => Awaitable<void>
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
