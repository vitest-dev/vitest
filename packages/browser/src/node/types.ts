import type { MockedModuleSerialized } from '@vitest/mocker'
import type { ServerIdResolution, ServerMockResolution } from '@vitest/mocker/node'
import type { TaskEventPack, TaskResultPack, TestAnnotation } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type {
  AfterSuiteRunMeta,
  BrowserTesterOptions,
  CancelReason,
  Reporter,
  RunnerTestFile,
  SnapshotResult,
  TestExecutionMethod,
  UserConsoleLog,
} from 'vitest'

export interface WebSocketBrowserHandlers {
  resolveSnapshotPath: (testPath: string) => string
  resolveSnapshotRawPath: (testPath: string, rawPath: string) => string
  onUnhandledError: (error: unknown, type: string) => Promise<void>
  onQueued: (method: TestExecutionMethod, file: RunnerTestFile) => void
  onCollected: (method: TestExecutionMethod, files: RunnerTestFile[]) => Promise<void>
  onTestAnnotate: (id: string, annotation: TestAnnotation) => void
  onTaskUpdate: (method: TestExecutionMethod, packs: TaskResultPack[], events: TaskEventPack[]) => void
  onAfterSuiteRun: (meta: AfterSuiteRunMeta) => void
  cancelCurrentRun: (reason: CancelReason) => void
  getCountOfFailedTests: () => number
  readSnapshotFile: (id: string) => Promise<string | null>
  saveSnapshotFile: (id: string, content: string) => Promise<void>
  removeSnapshotFile: (id: string) => Promise<void>
  sendLog: (method: TestExecutionMethod, log: UserConsoleLog) => void
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

  registerMock: (sessionId: string, mock: MockedModuleSerialized) => void
  unregisterMock: (sessionId: string, id: string) => void
  clearMocks: (sessionId: string) => void

  // cdp
  sendCdpEvent: (sessionId: string, event: string, payload?: Record<string, unknown>) => unknown
  trackCdpEvent: (sessionId: string, type: 'on' | 'once' | 'off', event: string, listenerId: string) => void
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
  createTesters: (options: BrowserTesterOptions) => Promise<void>
  cleanupTesters: () => Promise<void>
  cdpEvent: (event: string, payload: unknown) => void
  resolveManualMock: (url: string) => Promise<{
    url: string
    keys: string[]
    responseId: string
  }>
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
