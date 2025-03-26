export type { ErrorWithDiff, ParsedStack } from '@vitest/utils'

export type Awaitable<T> = T | PromiseLike<T>
export type Nullable<T> = T | null | undefined
export type Arrayable<T> = T | Array<T>
export type ArgumentsType<T> = T extends (...args: infer U) => any ? U : never

export type MutableArray<T extends readonly any[]> = {
  -readonly [k in keyof T]: T[k];
}

export interface Constructable {
  new (...args: any[]): any
}

export type TransformMode = 'web' | 'ssr'

/** @deprecated not used */
export interface ModuleCache {
  promise?: Promise<any>
  exports?: any
  code?: string
}

export interface AfterSuiteRunMeta {
  coverage?: unknown
  testFiles: string[]
  transformMode: TransformMode | 'browser'
  projectName?: string
}

export interface UserConsoleLog {
  content: string
  origin?: string
  browser?: boolean
  type: 'stdout' | 'stderr'
  taskId?: string
  time: number
  size: number
}

export interface ModuleGraphData {
  graph: Record<string, string[]>
  externalized: string[]
  inlined: string[]
}

export interface ProvidedContext {}
