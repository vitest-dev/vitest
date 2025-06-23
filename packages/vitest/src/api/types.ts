import type { File, TaskEventPack, TaskResultPack, TestAnnotation } from '@vitest/runner'
import type { BirpcReturn } from 'birpc'
import type { SerializedConfig } from '../runtime/config'
import type { SerializedTestSpecification } from '../runtime/types/utils'
import type { Awaitable, LabelColor, ModuleGraphData, UserConsoleLog } from '../types/general'

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
  onTaskUpdate: (packs: TaskResultPack[], events: TaskEventPack[]) => void
  getFiles: () => File[]
  getTestFiles: () => Promise<SerializedTestSpecification[]>
  getPaths: () => string[]
  getConfig: () => SerializedConfig
  getResolvedProjectLabels: () => { name: string; color?: LabelColor }[]
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
  rerun: (files: string[], resetTestNamePattern?: boolean) => Promise<void>
  rerunTask: (id: string) => Promise<void>
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
  onTestAnnotate?: (testId: string, annotation: TestAnnotation) => Awaitable<void>
  onTaskUpdate?: (packs: TaskResultPack[], events: TaskEventPack[]) => Awaitable<void>
  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
  onPathsCollected?: (paths?: string[]) => Awaitable<void>
  onSpecsCollected?: (specs?: SerializedTestSpecification[]) => Awaitable<void>
  onFinishedReportCoverage: () => void
}

export type WebSocketRPC = BirpcReturn<WebSocketEvents, WebSocketHandlers>
