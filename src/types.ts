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
export type TestState = RunMode | 'pass' | 'fail'
export type SuiteState = RunMode | 'pass' | 'fail'
export type ComputeMode = 'serial' | 'concurrent'

export interface Test {
  id: string
  type: 'test'
  name: string
  mode: RunMode
  computeMode: ComputeMode
  suite: Suite
  file?: File
  result?: TestResult
}

export interface TestResult {
  state: TestState
  start: number
  end?: number
  error?: unknown
}

export type Task = Test | Suite

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
  beforeEach: HookListener<[Test, Suite]>[]
  afterEach: HookListener<[Test, Suite]>[]
}

export interface Suite {
  type: 'suite'
  name: string
  mode: RunMode
  computeMode: ComputeMode
  tasks: Task[]
  file?: File
  result?: TestResult
}

export interface SuiteCollector {
  readonly name: string
  readonly mode: RunMode
  type: 'collector'
  test: TestCollector
  tasks: (Suite | Test | SuiteCollector)[]
  collect: (file?: File) => Promise<Suite>
  clear: () => void
  on: <T extends keyof SuiteHooks>(name: T, ...fn: SuiteHooks[T]) => void
}

export type TestFactory = (test: (name: string, fn: TestFunction) => void) => Awaitable<void>

export interface File extends Suite {
  filepath: string
}

export interface GlobalContext {
  tasks: (SuiteCollector | Test)[]
  currentSuite: SuiteCollector | null
}

export interface Reporter {
  onStart?: (config: ResolvedConfig) => Awaitable<void>
  onCollected?: (files: File[]) => Awaitable<void>
  onFinished?: (files: File[]) => Awaitable<void>

  onTestBegin?: (test: Test) => Awaitable<void>
  onTestEnd?: (test: Test) => Awaitable<void>
  onSuiteBegin?: (suite: Suite) => Awaitable<void>
  onSuiteEnd?: (suite: Suite) => Awaitable<void>

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
  onTestBegin: [[task: Task], void]
  onTestEnd: [[task: Task], void]

  onWatcherStart: [[], void]
  onWatcherRerun: [[files: string[], trigger: string], void]
}

export type RpcFn = <T extends keyof RpcMap>(method: T, ...args: RpcMap[T][0]) => Promise<RpcMap[T][1]>

export type RpcMessage<T extends keyof RpcMap = keyof RpcMap> = { id: string; method: T; args: RpcMap[T][0] }
