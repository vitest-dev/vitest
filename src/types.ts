/* eslint-disable no-use-before-define */
import { Awaitable } from '@antfu/utils'
import { SnapshotManager } from './integrations/chai/snapshot/manager'

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
}

export interface ResolvedConfig extends Required<UserOptions> {
  filters?: string[]
  config?: string
}

export type RunMode = 'run' | 'skip' | 'only' | 'todo'
export type TaskState = RunMode | 'pass' | 'fail'
export type SuiteState = RunMode | 'pass' | 'fail'
export type ComputeMode = 'serial' | 'concurrent'

export interface Task {
  type: 'task'
  name: string
  mode: RunMode
  computeMode: ComputeMode
  suite: Suite
  fn: () => Awaitable<void>
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

export interface Suite {
  type: 'suite'
  name: string
  mode: RunMode
  computeMode: ComputeMode
  children: (Task | Suite)[]
  state?: SuiteState
  file?: File
  error?: unknown
  status?: TaskState
  hooks: {
    beforeAll: HookListener<[Suite]>[]
    afterAll: HookListener<[Suite]>[]
    beforeEach: HookListener<[Task, Suite]>[]
    afterEach: HookListener<[Task, Suite]>[]
  }
}

export interface SuiteCollector {
  readonly name: string
  readonly mode: RunMode
  type: 'collector'
  test: TestCollector
  collect: (file?: File) => Promise<Suite>
  clear: () => void
  on: <T extends keyof Suite['hooks']>(name: T, ...fn: Suite['hooks'][T]) => void
}

export type TestFactory = (test: (name: string, fn: TestFunction) => void) => Awaitable<void>

export interface File extends Suite {
  filepath: string
  error?: unknown
}

export interface RunnerContext {
  filesMap: Record<string, File>
  files: File[]
  tasks: Task[]
  config: ResolvedConfig
  reporter: Reporter
  snapshotManager: SnapshotManager
}

export interface GlobalContext {
  children: (SuiteCollector | Task)[]
  currentSuite: SuiteCollector | null
}

export interface Reporter {
  onStart?: (config: ResolvedConfig) => Awaitable<void>
  onCollected?: (files: File[], ctx: RunnerContext) => Awaitable<void>
  onFinished?: (ctx: RunnerContext, files?: File[]) => Awaitable<void>

  onSuiteBegin?: (suite: Suite, ctx: RunnerContext) => Awaitable<void>
  onSuiteEnd?: (suite: Suite, ctx: RunnerContext) => Awaitable<void>
  onFileBegin?: (file: File, ctx: RunnerContext) => Awaitable<void>
  onFileEnd?: (file: File, ctx: RunnerContext) => Awaitable<void>
  onTaskBegin?: (task: Task, ctx: RunnerContext) => Awaitable<void>
  onTaskEnd?: (task: Task, ctx: RunnerContext) => Awaitable<void>

  onWatcherStart?: (ctx: RunnerContext) => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger: string, ctx: RunnerContext) => Awaitable<void>
}
