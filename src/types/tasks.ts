import type { Awaitable } from '@antfu/utils'

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
