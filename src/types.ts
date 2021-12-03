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

export interface Suite {
  name: string
  test: (name: string, fn: () => Promise<void> | void) => void
  collect: () => Promise<Task[]>
  clear: () => void
}

export interface File {
  filepath: string
  suites: Suite[]
  tasks: [Suite, Task[]][]
}

export interface GlobalContext {
  suites: Suite[]
  currentSuite: Suite | null
}
