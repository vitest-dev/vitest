import type { ChainableFunction } from '../runtime/chain'
import type { Awaitable, ErrorWithDiff, MutableArray } from './general'
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
export type EachFunction = <T>(cases: T[] | readonly T[]) => (name: string, fn: (...args: T extends any[] | readonly any[] ? MutableArray<T> : [T]) => void) => void

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

export type SuiteFactory = (test: (name: string, fn: TestFunction) => void) => void

export interface RuntimeContext {
  tasks: (SuiteCollector | Test)[]
  currentSuite: SuiteCollector | null
}
