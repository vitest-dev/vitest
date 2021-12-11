/* eslint-disable no-use-before-define */
import type { MessagePort } from 'worker_threads'
import type { Awaitable } from '@antfu/utils'
import type { TransformResult, ViteDevServer } from 'vite'
import type { OptionsReceived as PrettyFormatOptions } from 'pretty-format'
import type { StateManager } from './node/state'
import type { SnapshotResult } from './integrations/snapshot/utils/types'
import type { SnapshotManager } from './integrations/snapshot/manager'

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
    /**
     * Externalize means that Vite will bypass the package to native Node.
     *
     * Externaled dependencies will not be applied Vite's transformers and resolvers.
     * And does not support HMR on reload.
     *
     * Typically, packages under `node_modules` are externalized.
     */
    external?: (string | RegExp)[]
    /**
     * Vite will process inlined modules.
     *
     * This could be helpful to handle packages that ship `.js` in ESM format (that Node can't handle).
     */
    inline?: (string | RegExp)[]
  }

  /**
   * Register apis globally
   *
   * @default false
   */
  global?: boolean

  /**
   * Running environment
   *
   * Supports 'node', 'jsdom', 'happy-dom'
   *
   * @default 'node'
   */
  environment?: 'node' | 'jsdom' | 'happy-dom'

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

  /**
   * Enable multi-threading
   *
   * @default true
   */
  threads?: boolean

  /**
   * Maximum number of threads
   *
   * @default available CPUs
   */
  maxThreads?: number

  /**
   * Minimum number of threads
   *
   * @default available CPUs
   */
  minThreads?: number

  /*
   * Interpret CJS module's default as named exports
   *
   * @default true
   */
  interpretDefault?: boolean
}

export interface CliOptions extends UserOptions {
  /**
   * Filters by name
   */
  cliFilters?: string[]

  /**
   * Path to the config file.
   *
   * Default resolving to one of:
   * - `vitest.config.js`
   * - `vitest.config.ts`
   * - `vite.config.js`
   * - `vite.config.ts`
   */
  config?: string | undefined

  /**
   * Open Vitest UI
   */
  open?: boolean
}

export interface ResolvedConfig extends Omit<Required<CliOptions>, 'config' | 'filters'> {
  config?: string
  filters?: string[]

  depsInline: (string | RegExp)[]
  depsExternal: (string | RegExp)[]

  snapshotOptions: SnapshotStateOptions
}

export type RunMode = 'run' | 'skip' | 'only' | 'todo'
export type TaskState = RunMode | 'pass' | 'fail'
export type ComputeMode = 'serial' | 'concurrent'

export interface TaskBase {
  id: string
  name: string
  mode: RunMode
  computeMode: ComputeMode
  suite?: Suite
  file?: File
  result?: TaskResult
}

export interface TaskResult {
  state: TaskState
  start: number
  end?: number
  error?: unknown
}

export type TaskResultPack = [id: string, result: TaskResult | undefined]

export interface Suite extends TaskBase {
  type: 'suite'
  tasks: Task[]
}

export interface File extends Suite {
  filepath: string
}

export interface Test extends TaskBase {
  type: 'test'
  suite: Suite
  result?: TaskResult
}

export type Task = Test | Suite | File

export type TestFunction = () => Awaitable<void>

type TestCollectorFn = (name: string, fn: TestFunction, timeout?: number) => void

interface ConcurrentCollector {
  (name: string, fn: TestFunction, timeout?: number): void
  only: TestCollectorFn
  skip: TestCollectorFn
  todo: (name: string) => void
}

interface OnlyCollector {
  (name: string, fn: TestFunction, timeout?: number): void
  concurrent: TestCollectorFn
}

interface SkipCollector {
  (name: string, fn: TestFunction, timeout?: number): void
  concurrent: TestCollectorFn
}

interface TodoCollector {
  (name: string): void
  concurrent: (name: string) => void
}

export interface TestCollector {
  (name: string, fn: TestFunction, timeout?: number): void
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

export interface GlobalContext {
  tasks: (SuiteCollector | Test)[]
  currentSuite: SuiteCollector | null
}

export interface Reporter {
  onStart?: (files?: string[]) => Awaitable<void>
  onFinished?: (files?: File[]) => Awaitable<void>
  onTaskUpdate?: (pack: TaskResultPack) => Awaitable<void>

  onWatcherStart?: () => Awaitable<void>
  onWatcherRerun?: (files: string[], trigger: string) => Awaitable<void>
}

export interface ModuleCache {
  promise?: Promise<any>
  exports?: any
  transformResult?: TransformResult
}

export type SnapshotData = Record<string, string>

export type SnapshotUpdateState = 'all' | 'new' | 'none'

export type SnapshotStateOptions = {
  updateSnapshot: SnapshotUpdateState
  expand?: boolean
  snapshotFormat?: PrettyFormatOptions
}

export type SnapshotMatchOptions = {
  testName: string
  received: unknown
  key?: string
  inlineSnapshot?: string
  isInline: boolean
  error?: Error
}

export interface EnvironmentReturn {
  teardown: (global: any) => Awaitable<void>
}

export interface Environment {
  name: string
  setup(global: any): Awaitable<EnvironmentReturn>
}

export interface WorkerContext {
  port: MessagePort
  config: ResolvedConfig
  files: string[]
  invalidates?: string[]
}

export interface VitestContext {
  config: ResolvedConfig
  server: ViteDevServer
  state: StateManager
  snapshot: SnapshotManager
  reporter: Reporter
}

export interface RpcMap {
  workerReady: [[], void]
  fetch: [[id: string], TransformResult | null | undefined]
  onCollected: [[files: File[]], void]
  onFinished: [[], void]
  onTaskUpdate: [[pack: TaskResultPack], void]

  onWatcherStart: [[], void]
  onWatcherRerun: [[files: string[], trigger: string], void]

  snapshotSaved: [[snapshot: SnapshotResult], void]
}

export type RpcCall = <T extends keyof RpcMap>(method: T, ...args: RpcMap[T][0]) => Promise<RpcMap[T][1]>
export type RpcSend = <T extends keyof RpcMap>(method: T, ...args: RpcMap[T][0]) => void

export type RpcPayload<T extends keyof RpcMap = keyof RpcMap> = { id: string; method: T; args: RpcMap[T][0] }
