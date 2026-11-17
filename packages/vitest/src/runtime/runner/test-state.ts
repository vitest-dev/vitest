import type { Suite, Test } from './types'

export interface CurrentContext {
  task: Test | Suite | undefined
}

export interface CurrentContextStore {
  run: <T>(context: CurrentContext, fn: () => T) => T
  getStore: () => CurrentContext | undefined
}

let _test: Test | undefined
// vm pools evaluate this module twice, for the worker and for the test file;
// both copies install the store the worker creates in current-context.ts
let store: CurrentContextStore = {
  run: (_context, fn) => fn(),
  getStore: () => undefined,
}

export function setCurrentContextStore(value: CurrentContextStore): void {
  store = value
}

export function runInCurrentContext<T>(context: CurrentContext, fn: () => T): T {
  return store.run(context, fn)
}

export function setCurrentTest<T extends Test>(test: T | undefined): void {
  _test = test
}

export function getCurrentTest<T extends Test | undefined>(): T {
  const context = store.getStore()
  if (context) {
    return (context.task?.type === 'test' ? context.task : undefined) as T
  }
  return _test as T
}

export function getCurrentTask(): Test | Suite | undefined {
  return store.getStore()?.task
}

const tests = new Set<Test>()
export function addRunningTest(test: Test): () => void {
  tests.add(test)
  return () => {
    tests.delete(test)
  }
}

export function getRunningTests(): ReadonlySet<Test> {
  return tests
}

export function isCurrentTestDefinite(): boolean {
  // with no context, the one running test is only a guess, so code outside it,
  // such as a sibling suite's hooks or leftover work of an ended test, still reports it
  return store.getStore() !== undefined || tests.size <= 1
}
