export type Awaitable<T> = T | PromiseLike<T>
export type Nullable<T> = T | null | undefined
export type Arrayable<T> = T | Array<T>
export type ArgumentsType<T> = T extends (...args: infer U) => any ? U : never

export interface ModuleCache {
  promise?: Promise<any>
  exports?: any
  code?: string
}

export interface EnvironmentReturn {
  teardown: (global: any) => Awaitable<void>
}

export interface Environment {
  name: string
  setup(global: any, options: Record<string, any>): Awaitable<EnvironmentReturn>
}

export interface UserConsoleLog {
  content: string
  type: 'stdout' | 'stderr'
  taskId?: string
}

export interface Position {
  line: number
  column: number
}

export interface ParsedStack {
  method: string
  file: string
  line: number
  column: number
  sourcePos?: Position
}

export interface ErrorWithDiff extends Error {
  name: string
  nameStr?: string
  stack?: string
  stackStr?: string
  stacks?: ParsedStack[]
  showDiff?: boolean
  actual?: any
  expected?: any
  operator?: string
}
