/* eslint-disable no-use-before-define */

export interface Options {
  rootDir?: string
  includes?: string[]
  excludes?: string[]
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
  tasks: [Suite, Task[]][]
}

export interface GlobalContext {
  suites: Suite[]
  currentSuite: Suite | null
}
