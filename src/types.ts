/* eslint-disable no-use-before-define */
import { ViteDevServer } from 'vite'

export type Awaitable<T> = Promise<T> | T

export interface UserOptions {
  includes?: string[]
  excludes?: string[]

  /**
   * Register apis globally
   *
   * @default false
   */
  global?: boolean

  /**
   * Use `js-dom` to mock browser APIs
   *
   * @default false
   */
  jsdom?: boolean
}

export interface Config extends UserOptions {
  rootDir?: string
  updateSnapshot?: boolean
  nameFilters?: string[]

  // Internal
  server: ViteDevServer

  // TODO:
  watch?: boolean
}

export type RunMode = 'run' | 'skip' | 'only' | 'todo'
export type TaskState = RunMode | 'pass' | 'fail'

export interface Task {
  name: string
  mode: RunMode
  suite: Suite
  fn: () => Awaitable<void>
  file?: File
  state?: TaskState
  error?: unknown
}

export type TestFunction = () => Awaitable<void>

export interface TestCollector {
  (name: string, fn: TestFunction): void
  only: (name: string, fn: TestFunction) => void
  skip: (name: string, fn: TestFunction) => void
  todo: (name: string) => void
}

export interface Suite {
  name: string
  mode: RunMode
  tasks: Task[]
  file?: File
}

export interface SuiteCollector {
  name: string
  mode: RunMode
  test: TestCollector
  collect: (file?: File) => Promise<Suite>
  clear: () => void
}

export type TestFactory = (test: (name: string, fn: TestFunction) => void) => Awaitable<void>

export interface File {
  filepath: string
  suites: Suite[]
  collected: boolean
  error?: unknown
}

export interface RunnerContext {
  files: File[]
  config: Config
  reporter: Reporter
}

export interface GlobalContext {
  suites: SuiteCollector[]
  currentSuite: SuiteCollector | null
}

export interface Reporter {
  onStart: (userOptions: Config) => Awaitable<void>
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
