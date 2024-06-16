import type { TransformResult } from 'vite'
import type { CancelReason } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type { ViteNodeResolveId } from 'vite-node'
import type {
  AfterSuiteRunMeta,
  File,
  ModuleGraphData,
  ProvidedContext,
  Reporter,
  ResolvedConfig,
  SnapshotResult,
  TaskResultPack,
  UserConsoleLog,
} from '../types'

export interface TransformResultWithSource extends TransformResult {
  source?: string
}

export interface WebSocketHandlers {
  onCollected: (files?: File[]) => Promise<void>
  onTaskUpdate: (packs: TaskResultPack[]) => void
  getFiles: () => File[]
  getTestFiles: () => Promise<[{ name: string; root: string }, file: string][]>
  getPaths: () => string[]
  getConfig: () => ResolvedConfig
  getModuleGraph: (
    projectName: string,
    id: string,
    browser?: boolean
  ) => Promise<ModuleGraphData>
  getTransformResult: (
    projectName: string,
    id: string,
    browser?: boolean
  ) => Promise<TransformResultWithSource | undefined>
  readTestFile: (id: string) => Promise<string | null>
  saveTestFile: (id: string, content: string) => Promise<void>
  rerun: (files: string[]) => Promise<void>
  updateSnapshot: (file?: File) => Promise<void>
  getUnhandledErrors: () => unknown[]
}

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
  ) => Promise<ViteNodeResolveId | null>
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
  }>
  automock: (id: string) => Promise<string>
  invalidate: (ids: string[]) => void
  getBrowserFileSourceMap: (
    id: string
  ) => Promise<TransformResult['map'] | undefined>
  getProvidedContext: () => ProvidedContext
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
  startMocking: (id: string) => Promise<string[]>
  createTesters: (files: string[]) => Promise<void>
}

export type WebSocketRPC = BirpcReturn<WebSocketEvents, WebSocketHandlers>
export type WebSocketBrowserRPC = BirpcReturn<
  WebSocketBrowserEvents,
  WebSocketBrowserHandlers
>
