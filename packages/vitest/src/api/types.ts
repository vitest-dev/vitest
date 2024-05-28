import type { TransformResult } from 'vite'
import type { CancelReason } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type { AfterSuiteRunMeta, File, ModuleGraphData, ProvidedContext, Reporter, ResolvedConfig, SnapshotResult, TaskResultPack, UserConsoleLog } from '../types'

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
  getModuleGraph: (id: string) => Promise<ModuleGraphData>
  getTransformResult: (id: string) => Promise<TransformResultWithSource | undefined>
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
  finishBrowserTests: () => void
  snapshotSaved: (snapshot: SnapshotResult) => void
  getBrowserFiles: () => string[]
  debug: (...args: string[]) => void
  resolveId: (id: string, importer?: string) => Promise<string | null>
  triggerCommand: (command: string, testPath: string | undefined, payload: unknown[]) => Promise<void>
  queueMock: (id: string, importer: string, hasFactory: boolean) => Promise<string>
  queueUnmock: (id: string, importer: string) => Promise<string>
  invalidateMocks: () => void
  getBrowserFileSourceMap: (id: string) => Promise<TransformResult['map'] | undefined>
  getProvidedContext: () => ProvidedContext
}

export interface WebSocketEvents extends Pick<Reporter, 'onCollected' | 'onFinished' | 'onTaskUpdate' | 'onUserConsoleLog' | 'onPathsCollected' | 'onSpecsCollected'> {
  onFinishedReportCoverage: () => void
}

export interface WebSocketBrowserEvents {
  onCancel: (reason: CancelReason) => void
  startMocking: (id: string) => Promise<string[]>
}

export type WebSocketRPC = BirpcReturn<WebSocketEvents, WebSocketHandlers>
export type WebSocketBrowserRPC = BirpcReturn<WebSocketBrowserEvents, WebSocketBrowserHandlers>
