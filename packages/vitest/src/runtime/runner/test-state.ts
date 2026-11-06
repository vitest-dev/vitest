import type { Suite, Test } from './types'

export interface CurrentContext {
  task: Test | Suite | undefined
  active: boolean
}

export interface CurrentContextStore {
  run: <T>(context: CurrentContext, fn: () => T) => T
  get: () => CurrentContext | undefined
}

let _test: Test | undefined
let store: CurrentContextStore = {
  run: (_context, fn) => fn(),
  get: () => undefined,
}

export function setCurrentContextStore(value: CurrentContextStore): void {
  store = value
}

export function runInCurrentContext<T>(context: CurrentContext, fn: () => T): T {
  return store.run(context, fn)
}

// an inactive context belongs to shared setup that has finished, so what it left running falls back to the global slot
function getActiveContext(): CurrentContext | undefined {
  const context = store.get()
  return context?.active ? context : undefined
}

export function runInSharedSetupContext<T>(fn: () => Promise<T>): Promise<T> {
  const task = getCurrentTask()
  if (!task) {
    return fn()
  }
  const context: CurrentContext = { task, active: true }
  return store.run(context, fn).finally(() => {
    context.active = false
    context.task = undefined
  })
}

export function setCurrentTest<T extends Test>(test: T | undefined): void {
  _test = test
}

export function getCurrentTest<T extends Test | undefined>(): T {
  const context = getActiveContext()
  if (context) {
    return (context.task?.type === 'test' ? context.task : undefined) as T
  }
  return _test as T
}

export function getCurrentTask(): Test | Suite | undefined {
  return getActiveContext()?.task
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
  return getActiveContext() !== undefined || tests.size <= 1
}
