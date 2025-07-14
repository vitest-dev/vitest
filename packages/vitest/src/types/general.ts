export type { ParsedStack, TestError } from '@vitest/utils'

export type Awaitable<T> = T | PromiseLike<T>
export type Arrayable<T> = T | Array<T>
export type ArgumentsType<T> = T extends (...args: infer U) => any ? U : never

export type TransformMode = 'web' | 'ssr'

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

// These need to be compatible with Tinyrainbow's bg-colors, and CSS's background-color
export type LabelColor = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'
