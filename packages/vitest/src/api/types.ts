import type { BirpcReturn } from 'birpc'
import type { File, TaskResultPack } from '@vitest/runner'
import type { Awaitable, ModuleGraphData, UserConsoleLog } from '../types/general'
import type { SerializedConfig } from '../runtime/config'
import type { SerializedSpec } from '../runtime/types/utils'

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

export interface TransformResultWithSource {
  code: string
  map: SourceMap | {
    mappings: ''
  } | null
  etag?: string
  deps?: string[]
  dynamicDeps?: string[]
  source?: string
}

export interface WebSocketHandlers {
  onTaskUpdate: (packs: TaskResultPack[]) => void
  getFiles: () => File[]
  getTestFiles: () => Promise<SerializedSpec[]>
  getPaths: () => string[]
  getConfig: () => SerializedConfig
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

export interface WebSocketEvents {
  onCollected?: (files?: File[]) => Awaitable<void>
  onFinished?: (
    files: File[],
    errors: unknown[],
    coverage?: unknown
  ) => Awaitable<void>
  onTaskUpdate?: (packs: TaskResultPack[]) => Awaitable<void>
  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
  onPathsCollected?: (paths?: string[]) => Awaitable<void>
  onSpecsCollected?: (specs?: SerializedSpec[]) => Awaitable<void>
  onFinishedReportCoverage: () => void
}

export type WebSocketRPC = BirpcReturn<WebSocketEvents, WebSocketHandlers>
