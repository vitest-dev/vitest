export type { ParsedStack, TestError } from '@vitest/utils'

export type ArgumentsType<T> = T extends (...args: infer U) => any ? U : never

export interface AfterSuiteRunMeta {
  coverage?: unknown
  testFiles: string[]
  environment: string
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

export interface ResolveFunctionResult {
  id: string
  file: string
  url: string
}

export interface FetchCachedFileSystemResult {
  cached: true
  tmp: string
  id: string
  file: string | null
  url: string
  invalidate: boolean
}

// These need to be compatible with Tinyrainbow's bg-colors, and CSS's background-color
export type LabelColor = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white'

export interface AsyncLeak {
  filename: string
  projectName: string
  stack: string
  type: string
}
