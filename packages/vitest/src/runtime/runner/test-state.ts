import type { Test } from './types'

export interface CurrentContext {
  test: Test
}

export interface CurrentContextStore {
  run: <T>(context: CurrentContext, fn: () => T) => T
  exit: <T>(fn: () => T) => T
  get: () => CurrentContext | undefined
}

let _test: Test | undefined
let store: CurrentContextStore = {
  run: (_context, fn) => fn(),
  exit: (fn) => fn(),
  get: () => undefined,
}

export function setCurrentContextStore(value: CurrentContextStore): void {
  store = value
}

export function runInCurrentContext<T>(context: CurrentContext, fn: () => T): T {
  return store.run(context, fn)
}

export function exitCurrentContext<T>(fn: () => T): T {
  return store.exit(fn)
}

export function setCurrentTest<T extends Test>(test: T | undefined): void {
  _test = test
}

export function getCurrentTest<T extends Test | undefined>(): T {
  return (store.get()?.test ?? _test) as T
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

export function isCurrentTestAmbiguous(): boolean {
  return !store.get() && tests.size > 1
}
