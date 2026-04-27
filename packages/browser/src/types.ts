import type { MockedModuleSerialized, ServerIdResolution, ServerMockResolution } from '@vitest/mocker'
import type { TaskEventPack, TaskResultPack, TestArtifact } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type {
  AfterSuiteRunMeta,
  BrowserTesterOptions,
  CancelReason,
  RunnerTestFile,
  SerializedTestSpecification,
  SnapshotResult,
  TestExecutionMethod,
  UserConsoleLog,
} from 'vitest'

export type BrowserTraceEntryKind = 'action' | 'expect' | 'mark' | 'lifecycle'
export type BrowserTraceEntryStatus = 'pass' | 'fail'
export type BrowserTraceSelectorResolution = 'matched' | 'missing' | 'error'
export type PseudoClassName = ':hover' | ':active' | ':focus' | ':focus-visible' | ':focus-within'

interface TraceSnapshot {
  serialized: unknown
  viewport: {
    width: number
    height: number
  }
  scroll: {
    x: number
    y: number
  }
  selectorId?: number
  selectorResolution?: BrowserTraceSelectorResolution
  selectorError?: string
  pseudoClassIds: Record<PseudoClassName, number[]>
}

export interface BrowserTraceEntry {
  name: string
  kind: BrowserTraceEntryKind
  status?: BrowserTraceEntryStatus
  startTime: number
  duration?: number
  stack?: string
  location?: { file: string; line: number; column: number }
  selector?: string
  snapshot: TraceSnapshot
}

export interface WebSocketBrowserHandlers {
  resolveSnapshotPath: (testPath: string) => string
  resolveSnapshotRawPath: (testPath: string, rawPath: string) => string
  onUnhandledError: (error: unknown, type: string) => Promise<void>
  onQueued: (method: TestExecutionMethod, file: RunnerTestFile) => void
  onCollected: (method: TestExecutionMethod, files: RunnerTestFile[]) => Promise<void>
  onTaskArtifactRecord: <Artifact extends TestArtifact>(testId: string, artifact: Artifact) => Promise<Artifact>
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
    importer?: string,
  ) => Promise<ServerIdResolution | null>
  triggerCommand: <T>(
    sessionId: string,
    command: string,
    testPath: string | undefined,
    payload: unknown[],
  ) => Promise<T>
  resolveMock: (
    id: string,
    importer: string,
    options: { mock: 'spy' | 'factory' | 'auto' },
  ) => Promise<ServerMockResolution>
  invalidate: (ids: string[]) => void
  getBrowserFileSourceMap: (
    id: string,
  ) => SourceMap | null | { mappings: '' } | undefined
  wdioSwitchContext: (direction: 'iframe' | 'parent') => void

  registerMock: (sessionId: string, mock: MockedModuleSerialized) => void
  unregisterMock: (sessionId: string, id: string) => void
  clearMocks: (sessionId: string) => void

  streamBrowserTraceEntry: (testId: string, retry: number, repeats: number, recordCanvas: boolean, entry: BrowserTraceEntry) => void

  // cdp
  sendCdpEvent: (sessionId: string, event: string, payload?: Record<string, unknown>) => unknown
  trackCdpEvent: (sessionId: string, type: 'on' | 'once' | 'off', event: string, listenerId: string) => void
}

export type Awaitable<T> = T | PromiseLike<T>

export interface WebSocketEvents {
  onCollected?: (files: RunnerTestFile[]) => Awaitable<void>
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>
  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
  onPathsCollected?: (paths?: string[]) => Awaitable<void>
  onSpecsCollected?: (specs?: SerializedTestSpecification[]) => Awaitable<void>
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
