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
  error?: ErrorWithDiff
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

export interface Test extends TaskBase {
  type: 'test'
  suite: Suite
  result?: TaskResult
  fails?: boolean
}

export type Task = Test | Suite | File

export type DoneCallback = (error?: any) => void
export type TestFunction = (done: DoneCallback) => Awaitable<void>

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
    fn: (...args: T) => void
  ) => void
  <T extends ReadonlyArray<any>>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: ExtractEachCallbackArgs<T>) => void
  ) => void
  <T>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (...args: T[]) => void
  ) => void
}

export type TestAPI = ChainableFunction<
'concurrent' | 'only' | 'skip' | 'todo' | 'fails',
[name: string, fn?: TestFunction, timeout?: number],
void
> & { each: EachFunction }

export type SuiteAPI = ChainableFunction<
'concurrent' | 'only' | 'skip' | 'todo',
[name: string, factory?: SuiteFactory],
SuiteCollector
> & { each: EachFunction }

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
  test: TestAPI
  tasks: (Suite | Test | SuiteCollector)[]
  collect: (file?: File) => Promise<Suite>
  clear: () => void
  on: <T extends keyof SuiteHooks>(name: T, ...fn: SuiteHooks[T]) => void
}

export type SuiteFactory = (test: (name: string, fn: TestFunction) => void) => Awaitable<void>

export interface RuntimeContext {
  tasks: (SuiteCollector | Test)[]
  currentSuite: SuiteCollector | null
}
