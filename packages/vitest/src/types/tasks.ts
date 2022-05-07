import type { ChainableFunction } from '../runtime/chain'
import type { Awaitable, ErrorWithDiff } from './general'
import type { UserConsoleLog } from '.'

export type RunMode = 'run' | 'skip' | 'only' | 'todo'
export type TaskState = RunMode | 'pass' | 'fail'

export interface TaskBase {
  id: string
  name: string
  mode: RunMode
  concurrent?: boolean
  suite?: Suite
  file?: File
  result?: TaskResult
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
}

export type TaskResultPack = [id: string, result: TaskResult | undefined]

export interface Suite extends TaskBase {
  type: 'suite'
  tasks: Task[]
}

export interface File extends Suite {
  filepath: string
  collectDuration?: number
}

export interface Test<ExtraContext = {}> extends TaskBase {
  type: 'test'
  suite: Suite
  result?: TaskResult
  fails?: boolean
  context: TestContext & ExtraContext
}

export type Task = Test | Suite | File | Benchmark

export type DoneCallback = (error?: any) => void
export type TestFunction<ExtraContext = {}> = (context: TestContext & ExtraContext) => Awaitable<void>

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

interface EachFunction {
  <T extends any[] | [any]>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: T) => Awaitable<void>
  ) => void
  <T extends ReadonlyArray<any>>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: ExtractEachCallbackArgs<T>) => Awaitable<void>
  ) => void
  <T>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: T[]) => Awaitable<void>
  ) => void
}

export type TestAPI<ExtraContext = {}> = ChainableFunction<
'concurrent' | 'only' | 'skip' | 'todo' | 'fails',
[name: string, fn?: TestFunction<ExtraContext>, timeout?: number],
void
> & {
  each: EachFunction
  skipIf(condition: any): TestAPI<ExtraContext>
  runIf(condition: any): TestAPI<ExtraContext>
}

export type SuiteAPI<ExtraContext = {}> = ChainableFunction<
'concurrent' | 'only' | 'skip' | 'todo',
[name: string, factory?: SuiteFactory],
SuiteCollector<ExtraContext>
> & {
  each: EachFunction
  skipIf(condition: any): SuiteAPI<ExtraContext>
  runIf(condition: any): SuiteAPI<ExtraContext>
}

export type HookListener<T extends any[], Return = void> = (...args: T) => Awaitable<Return | void>

export interface SuiteHooks {
  beforeAll: HookListener<[Suite], () => Awaitable<void>>[]
  afterAll: HookListener<[Suite]>[]
  beforeEach: HookListener<[TestContext, Suite], () => Awaitable<void>>[]
  afterEach: HookListener<[TestContext, Suite]>[]
}

export type HookCleanupCallback = (() => Awaitable<void>) | void

export interface SuiteCollector<ExtraContext = {}> {
  readonly name: string
  readonly mode: RunMode
  type: 'collector'
  test: TestAPI<ExtraContext>
  tasks: (Suite | Test | SuiteCollector<ExtraContext>)[]
  collect: (file?: File) => Promise<Suite>
  clear: () => void
  on: <T extends keyof SuiteHooks>(name: T, ...fn: SuiteHooks[T]) => void
}

export type SuiteFactory = (test: (name: string, fn: TestFunction) => void) => Awaitable<void>

export interface RuntimeContext {
  tasks: (SuiteCollector | Test)[]
  currentSuite: SuiteCollector | null
}

/* benchmark */
export interface Benchmark extends TaskBase {
  type: 'benchmark'
  benchmark?: Benchmark
  tasks: Task[]
  result?: BenchmarkResult
}

export interface BenchmarkResult extends TaskResult {
  cycle: Array<{
    name: string
    count: number
    cycles: number
    hz: number
    rme: number
    sampleSize: number
  }>
  complete: {
    fastest: string
  }
}

export interface BenchmarkOptions {
  delay?: number | undefined
  initCount?: number | undefined
  maxTime?: number | undefined
  minSamples?: number | undefined
  minTime?: number | undefined
  async?: boolean | undefined
  defer?: boolean | undefined
  queued?: boolean | undefined
}

export type BenchFunction = () => Awaitable<void>

export type BenchmarkFactory = (test: (name: string, fn: BenchFunction, options?: BenchmarkOptions) => void) => Awaitable<void>

export interface BenchmarkCollector {
  readonly name: string
  readonly mode: RunMode
  tasks: (Benchmark | BenchmarkCollector)[]
  type: 'benchmark-collector'
  bench: (name: string, fn: BenchFunction, options?: BenchmarkOptions) => void
  collect: (file?: File) => Promise<Benchmark>
  clear: () => void
}

export interface BenchmarkContext {
  currentBenchmark: BenchmarkCollector | null
}

export interface TestContext {
  /**
   * @deprecated Use promise instead
   */
  (error?: any): void

  /**
   * Metadata of the current test
   */
  meta: Readonly<Test>

  /**
   * A expect instance bound to the test
   */
  expect: Vi.ExpectStatic
}
