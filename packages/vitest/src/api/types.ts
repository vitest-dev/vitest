import type { File, TaskEventPack, TaskResultPack, TestAnnotation, TestArtifact } from '@vitest/runner'
import type { Awaitable } from '@vitest/utils'
import type { BirpcReturn } from 'birpc'
import type { SerializedConfig } from '../runtime/config'
import type { SerializedTestSpecification } from '../runtime/types/utils'
import type { LabelColor, ModuleGraphData, UserConsoleLog } from '../types/general'
import type { ModuleDefinitionDurationsDiagnostic, UntrackedModuleDefinitionDiagnostic } from '../types/module-locations'

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

export interface ExternalResult {
  source?: string
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
  transformTime?: number
  modules?: ModuleDefinitionDurationsDiagnostic[]
  untrackedModules?: UntrackedModuleDefinitionDiagnostic[]
}

export interface WebSocketHandlers {
  getFiles: () => File[]
  getTestFiles: () => Promise<SerializedTestSpecification[]>
  getPaths: () => string[]
  getConfig: () => SerializedConfig
  getResolvedProjectLabels: () => { name: string; color?: LabelColor }[]
  getModuleGraph: (
    projectName: string,
    id: string,
    browser?: boolean,
  ) => Promise<ModuleGraphData>
  getTransformResult: (
    projectName: string,
    id: string,
    testFileId: string,
    browser?: boolean,
  ) => Promise<TransformResultWithSource | undefined>
  getExternalResult: (
    id: string,
    testFileId: string,
  ) => Promise<ExternalResult | undefined>
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
    coverage?: unknown,
    executionTime?: number,
  ) => Awaitable<void>
  onTestAnnotate?: (testId: string, annotation: TestAnnotation) => Awaitable<void>
  onTestArtifactRecord?: (testId: string, artifact: TestArtifact) => Awaitable<void>
  onTaskUpdate?: (packs: TaskResultPack[], events: TaskEventPack[]) => Awaitable<void>
  onUserConsoleLog?: (log: UserConsoleLog) => Awaitable<void>
  onPathsCollected?: (paths?: string[]) => Awaitable<void>
  onSpecsCollected?: (specs?: SerializedTestSpecification[], startTime?: number) => Awaitable<void>
  onFinishedReportCoverage: () => void
}

export type WebSocketRPC = BirpcReturn<WebSocketEvents, WebSocketHandlers>
