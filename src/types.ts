/* eslint-disable no-use-before-define */

export interface UserOptions {
  includes?: string[]
  excludes?: string[]
}

export interface Options extends UserOptions {
  rootDir?: string
  updateSnapshot?: boolean
}

export interface Task {
  name: string
  suite: Suite
  fn: () => Promise<void> | void
  file?: File
}

export interface TaskResult {
  task: Task
  error?: unknown
}

export type SuiteMode = 'run' | 'skip' | 'only' | 'todo'

export interface Suite {
  name: string
  mode: SuiteMode
  test: (name: string, fn: () => Promise<void> | void) => void
  collect: () => Promise<Task[]>
  clear: () => void
}

export type TestFactory = (test: Suite['test']) => Promise<void> | void

export interface File {
  filepath: string
  suites: Suite[]
  collected: [Suite, Task[]][]
}

export interface GlobalContext {
  suites: Suite[]
  currentSuite: Suite | null
}
