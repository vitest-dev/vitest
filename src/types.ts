/* eslint-disable no-use-before-define */

export type Awaitable<T> = Promise<T> | T

export interface UserOptions {
  includes?: string[]
  excludes?: string[]
}

export interface Options extends UserOptions {
  rootDir?: string
  updateSnapshot?: boolean
}

export type RunMode = 'run' | 'skip' | 'only' | 'todo'
export type TaskStatus = 'init' | 'pass' | 'fail' | 'skip' | 'todo'

export interface Task {
  name: string
  mode: RunMode
  suite: Suite
  fn: () => Awaitable<void>
  file?: File
  status: TaskStatus
  error?: unknown
}

export type TestFunction = () => Awaitable<void>

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

export type TestFactory = (test: (name: string, fn: TestFunction) => void) => Awaitable<void>

export interface File {
  filepath: string
  suites: Suite[]
  collected: [Suite, Task[]][]
}

export interface RunnerContext {
  files: File[]
  mode: 'all' | 'only'
  userOptions: Options
  reporter: Reporter
}

export interface GlobalContext {
  suites: Suite[]
  currentSuite: Suite | null
}

export interface Reporter {
  onStart: (userOptions: Options) => Awaitable<void>
  onCollected: (ctx: RunnerContext) => Awaitable<void>
  onFinished: (ctx: RunnerContext) => Awaitable<void>

  onSuiteBegin: (suite: Suite, ctx: RunnerContext) => Awaitable<void>
  onSuiteEnd: (suite: Suite, ctx: RunnerContext) => Awaitable<void>
  onFileBegin: (file: File, ctx: RunnerContext) => Awaitable<void>
  onFileEnd: (file: File, ctx: RunnerContext) => Awaitable<void>
  onTaskBegin: (task: Task, ctx: RunnerContext) => Awaitable<void>
  onTaskEnd: (task: Task, ctx: RunnerContext) => Awaitable<void>

  // TODO:
  onSnapshotUpdate: () => Awaitable<void>
}
