import type { Awaitable, ErrorWithDiff } from '@vitest/utils'
import type { ChainableFunction } from '../utils/chain'
import type { FixtureItem } from '../fixture'

export type RunMode = 'run' | 'skip' | 'only' | 'todo'
export type TaskState = RunMode | 'pass' | 'fail'

export interface TaskBase {
  id: string
  name: string
  mode: RunMode
  meta: TaskMeta
  each?: boolean
  concurrent?: boolean
  shuffle?: boolean
  suite?: Suite
  file?: File
  result?: TaskResult
  retry?: number
  repeats?: number
}

export interface TaskPopulated extends TaskBase {
  suite: Suite
  pending?: boolean
  result?: TaskResult
  fails?: boolean
  onFailed?: OnTestFailedHandler[]
  /**
   * Store promises (from async expects) to wait for them before finishing the test
   */
  promises?: Promise<any>[]
}

export interface TaskMeta {}

export interface TaskResult {
  state: TaskState
  duration?: number
  startTime?: number
  heap?: number
  errors?: ErrorWithDiff[]
  htmlError?: string
  hooks?: Partial<Record<keyof SuiteHooks, TaskState>>
  retryCount?: number
  repeatCount?: number
}

export type TaskResultPack = [id: string, result: TaskResult | undefined, meta: TaskMeta]

export interface Suite extends TaskBase {
  type: 'suite'
  tasks: Task[]
  filepath?: string
  projectName: string
}

export interface File extends Suite {
  filepath: string
  collectDuration?: number
  setupDuration?: number
}

export interface Test<ExtraContext = {}> extends TaskPopulated {
  type: 'test'
  context: TaskContext<Test> & ExtraContext & TestContext
}

export interface Custom<ExtraContext = {}> extends TaskPopulated {
  type: 'custom'
  context: TaskContext<Custom> & ExtraContext & TestContext
}

export type Task = Test | Suite | Custom | File

export type DoneCallback = (error?: any) => void
export type TestFunction<ExtraContext = {}> = (context: ExtendedContext<Test> & ExtraContext) => Awaitable<any> | void

// jest's ExtractEachCallbackArgs
type ExtractEachCallbackArgs<T extends ReadonlyArray<any>> = {
  1: [T[0]]
  2: [T[0], T[1]]
  3: [T[0], T[1], T[2]]
  4: [T[0], T[1], T[2], T[3]]
  5: [T[0], T[1], T[2], T[3], T[4]]
  6: [T[0], T[1], T[2], T[3], T[4], T[5]]
  7: [T[0], T[1], T[2], T[3], T[4], T[5], T[6]]
  8: [T[0], T[1], T[2], T[3], T[4], T[5], T[6], T[7]]
  9: [T[0], T[1], T[2], T[3], T[4], T[5], T[6], T[7], T[8]]
  10: [T[0], T[1], T[2], T[3], T[4], T[5], T[6], T[7], T[8], T[9]]
  fallback: Array<T extends ReadonlyArray<infer U> ? U : any>
}[T extends Readonly<[any]>
  ? 1
  : T extends Readonly<[any, any]>
    ? 2
    : T extends Readonly<[any, any, any]>
      ? 3
      : T extends Readonly<[any, any, any, any]>
        ? 4
        : T extends Readonly<[any, any, any, any, any]>
          ? 5
          : T extends Readonly<[any, any, any, any, any, any]>
            ? 6
            : T extends Readonly<[any, any, any, any, any, any, any]>
              ? 7
              : T extends Readonly<[any, any, any, any, any, any, any, any]>
                ? 8
                : T extends Readonly<[any, any, any, any, any, any, any, any, any]>
                  ? 9
                  : T extends Readonly<[any, any, any, any, any, any, any, any, any, any]>
                    ? 10
                    : 'fallback']

interface SuiteEachFunction {
  <T extends any[] | [any]>(cases: ReadonlyArray<T>): (
    name: string | Function,
    fn: (...args: T) => Awaitable<void>,
  ) => void
  <T extends ReadonlyArray<any>>(cases: ReadonlyArray<T>): (
    name: string | Function,
    fn: (...args: ExtractEachCallbackArgs<T>) => Awaitable<void>,
  ) => void
  <T>(cases: ReadonlyArray<T>): (
    name: string | Function,
    fn: (...args: T[]) => Awaitable<void>,
  ) => void
}

interface TestEachFunction {
  <T extends any[] | [any]>(cases: ReadonlyArray<T>): (
    name: string | Function,
    fn: (...args: T) => Awaitable<void>,
    options?: number | TestOptions,
  ) => void
  <T extends ReadonlyArray<any>>(cases: ReadonlyArray<T>): (
    name: string | Function,
    fn: (...args: ExtractEachCallbackArgs<T>) => Awaitable<void>,
    options?: number | TestOptions,
  ) => void
  <T>(cases: ReadonlyArray<T>): (
    name: string | Function,
    fn: (...args: T[]) => Awaitable<void>,
    options?: number | TestOptions,
  ) => void
  (...args: [TemplateStringsArray, ...any]): (
    name: string | Function,
    fn: (...args: any[]) => Awaitable<void>,
    options?: number | TestOptions,
  ) => void
}

type ChainableTestAPI<ExtraContext = {}> = ChainableFunction<
  'concurrent' | 'sequential' | 'only' | 'skip' | 'todo' | 'fails',
  [name: string | Function, fn?: TestFunction<ExtraContext>, options?: number | TestOptions],
  void,
  {
    each: TestEachFunction
    <T extends ExtraContext>(name: string | Function, fn?: TestFunction<T>, options?: number | TestOptions): void
  }
>

export interface TestOptions {
  /**
   * Test timeout.
   */
  timeout?: number
  /**
   * Times to retry the test if fails. Useful for making flaky tests more stable.
   * When retries is up, the last test error will be thrown.
   *
   * @default 0
   */
  retry?: number
  /**
   * How many times the test will run.
   * Only inner tests will repeat if set on `describe()`, nested `describe()` will inherit parent's repeat by default.
   *
   * @default 0
   */
  repeats?: number
  /**
   * Whether tests run concurrently.
   * Tests inherit `concurrent` from `describe()` and nested `describe()` will inherit from parent's `concurrent`.
   */
  concurrent?: boolean
  /**
   * Whether tests run sequentially.
   * Tests inherit `sequential` from `describe()` and nested `describe()` will inherit from parent's `sequential`.
   */
  sequential?: boolean
}

interface ExtendedAPI<ExtraContext> {
  each: TestEachFunction
  skipIf(condition: any): ChainableTestAPI<ExtraContext>
  runIf(condition: any): ChainableTestAPI<ExtraContext>
}

export type CustomAPI<ExtraContext = {}> = ChainableTestAPI<ExtraContext> & ExtendedAPI<ExtraContext> & {
  extend<T extends Record<string, any> = {}>(fixtures: Fixtures<T, ExtraContext>): CustomAPI<{
    [K in keyof T | keyof ExtraContext]:
    K extends keyof T ? T[K] :
      K extends keyof ExtraContext ? ExtraContext[K] : never }>
}

export type TestAPI<ExtraContext = {}> = ChainableTestAPI<ExtraContext> & ExtendedAPI<ExtraContext> & {
  extend<T extends Record<string, any> = {}>(fixtures: Fixtures<T, ExtraContext>): TestAPI<{
    [K in keyof T | keyof ExtraContext]:
    K extends keyof T ? T[K] :
      K extends keyof ExtraContext ? ExtraContext[K] : never }>
}

export type Use<T> = (value: T) => Promise<void>
export type FixtureFn<T, K extends keyof T, ExtraContext> =
  (context: Omit<T, K> & ExtraContext, use: Use<T[K]>) => Promise<void>
export type Fixture<T, K extends keyof T, ExtraContext = {}> =
  ((...args: any) => any) extends T[K]
    ? (T[K] extends any ? FixtureFn<T, K, Omit<ExtraContext, Exclude<keyof T, K>>> : never)
    : T[K] | (T[K] extends any ? FixtureFn<T, K, Omit<ExtraContext, Exclude<keyof T, K>>> : never)
export type Fixtures<T extends Record<string, any>, ExtraContext = {}> = {
  [K in keyof T]: Fixture<T, K, ExtraContext & ExtendedContext<Test>>
}

export type InferFixturesTypes<T> = T extends TestAPI<infer C> ? C : T

type ChainableSuiteAPI<ExtraContext = {}> = ChainableFunction<
  'concurrent' | 'sequential' | 'only' | 'skip' | 'todo' | 'shuffle',
  [name: string | Function, factory?: SuiteFactory<ExtraContext>, options?: number | TestOptions],
  SuiteCollector<ExtraContext>,
  {
    each: TestEachFunction
    <T extends ExtraContext>(name: string | Function, factory?: SuiteFactory<T>): SuiteCollector<T>
  }
>

export type SuiteAPI<ExtraContext = {}> = ChainableSuiteAPI<ExtraContext> & {
  each: SuiteEachFunction
  skipIf(condition: any): ChainableSuiteAPI<ExtraContext>
  runIf(condition: any): ChainableSuiteAPI<ExtraContext>
}

export type HookListener<T extends any[], Return = void> = (...args: T) => Awaitable<Return>

export type HookCleanupCallback = (() => Awaitable<unknown>) | void

export interface SuiteHooks<ExtraContext = {}> {
  beforeAll: HookListener<[Readonly<Suite | File>], HookCleanupCallback>[]
  afterAll: HookListener<[Readonly<Suite | File>]>[]
  beforeEach: HookListener<[ExtendedContext<Test | Custom> & ExtraContext, Readonly<Suite>], HookCleanupCallback>[]
  afterEach: HookListener<[ExtendedContext<Test | Custom> & ExtraContext, Readonly<Suite>]>[]
}

export interface TaskCustomOptions extends TestOptions {
  concurrent?: boolean
  sequential?: boolean
  skip?: boolean
  only?: boolean
  todo?: boolean
  fails?: boolean
  each?: boolean
  meta?: Record<string, unknown>
  fixtures?: FixtureItem[]
  handler?: (context: TaskContext<Custom>) => Awaitable<void>
}

export interface SuiteCollector<ExtraContext = {}> {
  readonly name: string
  readonly mode: RunMode
  options?: TestOptions
  type: 'collector'
  test: TestAPI<ExtraContext>
  tasks: (Suite | Custom<ExtraContext> | Test<ExtraContext> | SuiteCollector<ExtraContext>)[]
  task: (name: string, options?: TaskCustomOptions) => Custom<ExtraContext>
  collect: (file?: File) => Promise<Suite>
  clear: () => void
  on: <T extends keyof SuiteHooks<ExtraContext>>(name: T, ...fn: SuiteHooks<ExtraContext>[T]) => void
}

export type SuiteFactory<ExtraContext = {}> = (test: (name: string | Function, fn: TestFunction<ExtraContext>) => void) => Awaitable<void>

export interface RuntimeContext {
  tasks: (SuiteCollector | Test)[]
  currentSuite: SuiteCollector | null
}

export interface TestContext {}

export interface TaskContext<Task extends Custom | Test = Custom | Test> {
  /**
   * Metadata of the current test
   */
  task: Readonly<Task>

  /**
   * Extract hooks on test failed
   */
  onTestFailed: (fn: OnTestFailedHandler) => void

  /**
   * Mark tests as skipped. All execution after this call will be skipped.
   */
  skip: () => void
}

export type ExtendedContext<T extends Custom | Test> = TaskContext<T> & TestContext

export type OnTestFailedHandler = (result: TaskResult) => Awaitable<void>

export type SequenceHooks = 'stack' | 'list' | 'parallel'
export type SequenceSetupFiles = 'list' | 'parallel'
