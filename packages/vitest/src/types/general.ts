export type { ErrorWithDiff, ParsedStack } from '@vitest/utils'

export type Awaitable<T> = T | PromiseLike<T>
export type Nullable<T> = T | null | undefined
export type Arrayable<T> = T | Array<T>
export type ArgumentsType<T> = T extends (...args: infer U) => any ? U : never

export type MutableArray<T extends readonly any[]> = { -readonly [k in keyof T]: T[k] }

export interface Constructable {
  new (...args: any[]): any
}

export interface ModuleCache {
  promise?: Promise<any>
  exports?: any
  code?: string
}

export interface EnvironmentReturn {
  teardown(global: any): Awaitable<void>
}

export interface VmEnvironmentReturn {
  getVmContext(): { [key: string]: any }
  teardown(): Awaitable<void>
}

export interface Environment {
  name: string
  transformMode: 'web' | 'ssr'
  setupVM?(options: Record<string, any>): Awaitable<VmEnvironmentReturn>
  setup(global: any, options: Record<string, any>): Awaitable<EnvironmentReturn>
}

export interface UserConsoleLog {
  content: string
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

export type OnServerRestartHandler = (reason?: string) => Promise<void> | void

export interface ProvidedContext {}
