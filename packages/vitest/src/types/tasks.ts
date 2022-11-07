import type { ChainableFunction } from '../runtime/chain'
import type { BenchFactory } from './benchmark'
import type { Awaitable, ErrorWithDiff } from './general'
import type { Benchmark, BenchmarkAPI, BenchmarkResult, UserConsoleLog } from '.'

export type RunMode = 'run' | 'skip' | 'only' | 'todo'
export type TaskState = RunMode | 'pass' | 'fail'

export interface TaskBase {
  id: string
  name: string
  mode: RunMode
  concurrent?: boolean
  shuffle?: boolean
  suite?: Suite
  file?: File
  result?: TaskResult
  retry?: number
  logs?: UserConsoleLog[]
}

export interface TaskResult {
  state: TaskState
  duration?: number
  startTime?: number
  heap?: number
  error?: ErrorWithDiff
  htmlError?: string
  hooks?: Partial<Record<keyof SuiteHooks, TaskState>>
  benchmark?: BenchmarkResult
  retryCount?: number
}

export type TaskResultPack = [id: string, result: TaskResult | undefined]

export interface Suite extends TaskBase {
  type: 'suite'
  tasks: Task[]
  filepath?: string
  benchmark?: BenchFactory
}

export interface File extends Suite {
  filepath: string
  collectDuration?: number
  setupDuration?: number
}

export interface Test<ExtraContext = {}> extends TaskBase {
  type: 'test'
  suite: Suite
  result?: TaskResult
  fails?: boolean
  context: TestContext & ExtraContext
  onFailed?: OnTestFailedHandler[]
}

export interface TypeCheck extends TaskBase {
  type: 'typecheck'
}

export type Task = Test | Suite | File | Benchmark | TypeCheck

export type DoneCallback = (error?: any) => void
export type TestFunction<ExtraContext = {}> = (context: TestContext & ExtraContext) => Awaitable<any> | void

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
    name: string,
    fn: (...args: T) => Awaitable<void>,
  ) => void
  <T extends ReadonlyArray<any>>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: ExtractEachCallbackArgs<T>) => Awaitable<void>,
  ) => void
  <T>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: T[]) => Awaitable<void>,
  ) => void
}

interface TestEachFunction {
  <T extends any[] | [any]>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: T) => Awaitable<void>,
    options?: number | TestOptions,
  ) => void
  <T extends ReadonlyArray<any>>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: ExtractEachCallbackArgs<T>) => Awaitable<void>,
    options?: number | TestOptions,
  ) => void
  <T>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: T[]) => Awaitable<void>,
    options?: number | TestOptions,
  ) => void
}

type ChainableTestAPI<ExtraContext = {}> = ChainableFunction<
  'concurrent' | 'only' | 'skip' | 'todo' | 'fails',
  [name: string, fn?: TestFunction<ExtraContext>, options?: number | TestOptions],
  void,
  {
    each: TestEachFunction
    <T extends ExtraContext>(name: string, fn?: TestFunction<T>, options?: number | TestOptions): void
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
   * @default 1
   */
  retry?: number
}

export type TestAPI<ExtraContext = {}> = ChainableTestAPI<ExtraContext> & {
  each: TestEachFunction
  skipIf(condition: any): ChainableTestAPI<ExtraContext>
  runIf(condition: any): ChainableTestAPI<ExtraContext>
}

type ChainableSuiteAPI<ExtraContext = {}> = ChainableFunction<
  'concurrent' | 'only' | 'skip' | 'todo' | 'shuffle',
  [name: string, factory?: SuiteFactory<ExtraContext>, options?: number | TestOptions],
  SuiteCollector<ExtraContext>,
  {
    each: TestEachFunction
    <T extends ExtraContext>(name: string, factory?: SuiteFactory<T>): SuiteCollector<T>
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
  beforeAll: HookListener<[Suite | File], HookCleanupCallback>[]
  afterAll: HookListener<[Suite | File]>[]
  beforeEach: HookListener<[TestContext & ExtraContext, Suite], HookCleanupCallback>[]
  afterEach: HookListener<[TestContext & ExtraContext, Suite]>[]
}

export interface SuiteCollector<ExtraContext = {}> {
  readonly name: string
  readonly mode: RunMode
  type: 'collector'
  test: TestAPI<ExtraContext>
  benchmark: BenchmarkAPI
  tasks: (Suite | Test | Benchmark | SuiteCollector<ExtraContext>)[]
  collect: (file?: File) => Promise<Suite>
  clear: () => void
  on: <T extends keyof SuiteHooks<ExtraContext>>(name: T, ...fn: SuiteHooks<ExtraContext>[T]) => void
}

export type SuiteFactory<ExtraContext = {}> = (test: (name: string, fn: TestFunction<ExtraContext>) => void) => Awaitable<void>

export interface RuntimeContext {
  tasks: (SuiteCollector | Test)[]
  currentSuite: SuiteCollector | null
}

export interface TestContext {
  /**
   * Metadata of the current test
   */
  meta: Readonly<Test>

  /**
   * A expect instance bound to the test
   */
  expect: Vi.ExpectStatic

  /**
   * Extract hooks on test failed
   */
  onTestFailed: (fn: OnTestFailedHandler) => void
}

export type OnTestFailedHandler = (result: TaskResult) => Awaitable<void>
