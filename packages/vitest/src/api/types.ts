import type { TransformResult } from 'vite'
import type { BirpcReturn } from 'birpc'
import type {
  File,
  ModuleGraphData,
  Reporter,
  SerializableSpec,
  SerializedConfig,
  TaskResultPack,
} from '../types'

export interface TransformResultWithSource extends TransformResult {
  source?: string
}

export interface WebSocketHandlers {
  onCollected: (files?: File[]) => Promise<void>
  onTaskUpdate: (packs: TaskResultPack[]) => void
  getFiles: () => File[]
  getTestFiles: () => Promise<SerializableSpec[]>
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

export type WebSocketRPC = BirpcReturn<WebSocketEvents, WebSocketHandlers>
