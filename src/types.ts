/* eslint-disable no-use-before-define */

export interface UserOptions {
  includes?: string[]
  excludes?: string[]
}

export interface Options extends UserOptions {
  rootDir?: string
  updateSnapshot?: boolean
}

export interface TaskResult {
  error?: unknown
}

export type RunMode = 'run' | 'skip' | 'only' | 'todo'

export interface Task {
  name: string
  mode: RunMode
  suite: Suite
  fn: () => Promise<void> | void
  file?: File
  result?: TaskResult
}

export type TestFunction = () => Promise<void> | void

export interface Test {
  (name: string, fn: TestFunction): void
  only: (name: string, fn: TestFunction) => void
  skip: (name: string, fn: TestFunction) => void
  todo: (name: string) => void
}

export interface Suite {
  name: string
  mode: RunMode
  test: Test
  collect: () => Promise<Task[]>
  clear: () => void
}

export type TestFactory = (test: (name: string, fn: TestFunction) => void) => Promise<void> | void

export interface File {
  filepath: string
  suites: Suite[]
  collected: [Suite, Task[]][]
}

export interface GlobalContext {
  suites: Suite[]
  currentSuite: Suite | null
}
