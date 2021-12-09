/* eslint-disable no-use-before-define */
import { MessagePort } from 'worker_threads'
import { Awaitable } from '@antfu/utils'
import { TransformResult } from 'vite'

export interface UserOptions {
  /**
   * Include globs for test files
   *
   * @default ['**\/*.test.ts']
   */
  includes?: string[]

  /**
   * Exclude globs for test files
   * @default ['**\/node_modules\/**']
   */
  excludes?: string[]

  /**
   * Handling for dependencies inlining or externalizing
   */
  deps?: {
    external?: (string | RegExp)[]
    inline?: (string | RegExp)[]
  }

  /**
   * Register apis globally
   *
   * @default false
   */
  global?: boolean

  /**
   * Use `jsdom` or `happy-dom` to mock browser APIs
   *
   * @default false
   */
  dom?: boolean | 'jsdom' | 'happy-dom'

  /**
   * Run tests files in parallel
   *
   * @default false
   */
  parallel?: boolean

  /**
   * Update snapshot files
   *
   * @default false
   */
  update?: boolean

  /**
   * Watch mode
   *
   * @default false
   */
  watch?: boolean

  /**
   * Project root
   */
  root?: string

  /**
   * Custom reporter for output
   */
  reporter?: Reporter

  filters?: string[]
  config?: string | undefined
}

export interface ResolvedConfig extends Omit<Required<UserOptions>, 'config' | 'filters'> {
  config?: string
  filters?: string[]

  depsInline: (string | RegExp)[]
  depsExternal: (string | RegExp)[]
}

export type RunMode = 'run' | 'skip' | 'only' | 'todo'
export type TaskState = RunMode | 'pass' | 'fail'
export type ComputeMode = 'serial' | 'concurrent'

export interface Task {
  id: string
  name: string
  mode: RunMode
  computeMode: ComputeMode
  suite: Suite
  file?: File
  state?: TaskState
  error?: unknown
}

export type TestFunction = () => Awaitable<void>

interface ConcurrentCollector {
  (name: string, fn: TestFunction): void
  only: (name: string, fn: TestFunction) => void
  skip: (name: string, fn: TestFunction) => void
  todo: (name: string) => void
}

interface OnlyCollector {
  (name: string, fn: TestFunction): void
  concurrent: (name: string, fn: TestFunction) => void
}

interface SkipCollector {
  (name: string, fn: TestFunction): void
  concurrent: (name: string, fn: TestFunction) => void
}

interface TodoCollector {
  (name: string): void
  concurrent: (name: string) => void
}

export interface TestCollector {
  (name: string, fn: TestFunction): void
  concurrent: ConcurrentCollector
  only: OnlyCollector
  skip: SkipCollector
  todo: TodoCollector
}

export type HookListener<T extends any[]> = (...args: T) => Awaitable<void>

export interface SuiteHooks {
  beforeAll: HookListener<[Suite]>[]
  afterAll: HookListener<[Suite]>[]
  beforeEach: HookListener<[Task, Suite]>[]
  afterEach: HookListener<[Task, Suite]>[]
}

export interface Suite {
  name: string
  mode: RunMode
  tasks: Task[]
  file?: File
  error?: unknown
  status?: TaskState
}

export interface SuiteCollector {
  readonly name: string
  readonly mode: RunMode
  test: TestCollector
  collect: (file?: File) => Promise<Suite>
  clear: () => void
  on: <T extends keyof SuiteHooks>(name: T, ...fn: SuiteHooks[T]) => void
}

export type TestFactory = (test: (name: string, fn: TestFunction) => void) => Awaitable<void>

export interface File {
  filepath: string
  suites: Suite[]
  collected: boolean
  error?: unknown
}

export interface RunnerContext {
  filesMap: Record<string, File>
  files: File[]
  suites: Suite[]
  tasks: Task[]
  config: ResolvedConfig
  // reporter: Reporter
  // snapshotManager: SnapshotManager
}

export interface GlobalContext {
  suites: SuiteCollector[]
  currentSuite: SuiteCollector | null
}

export interface Reporter {
  onStart?: (config: ResolvedConfig) => Awaitable<void>
  onCollected?: (files: File[]) => Awaitable<void>
  onFinished?: (files: File[]) => Awaitable<void>

  onSuiteBegin?: (suite: Suite) => Awaitable<void>
  onSuiteEnd?: (suite: Suite) => Awaitable<void>
  onFileBegin?: (file: File) => Awaitable<void>
  onFileEnd?: (file: File) => Awaitable<void>
  onTaskBegin?: (task: Task) => Awaitable<void>
  onTaskEnd?: (task: Task) => Awaitable<void>

  onWatcherStart?: () => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger: string) => Awaitable<void>
}

export interface WorkerContext {
  port: MessagePort
  files: string[]
  config: ResolvedConfig
  reporter: Reporter
}

export interface RpcMap {
  fetch: [[id: string], TransformResult | null | undefined]
  onStart: [[], void]
  onCollected: [[files: File[]], void]
  onFinished: [[files: File[]], void]

  onSuiteBegin: [[suite: Suite], void]
  onSuiteEnd: [[suite: Suite], void]
  onFileBegin: [[file: File], void]
  onFileEnd: [[file: File], void]
  onTaskBegin: [[task: Task], void]
  onTaskEnd: [[task: Task], void]

  onWatcherStart: [[], void]
  onWatcherRerun: [[files: string[], trigger: string], void]
}

export type RpcFn = <T extends keyof RpcMap>(method: T, ...args: RpcMap[T][0]) => Promise<RpcMap[T][1]>

export type RpcMessage<T extends keyof RpcMap = keyof RpcMap> = { id: string; method: T; args: RpcMap[T][0] }
