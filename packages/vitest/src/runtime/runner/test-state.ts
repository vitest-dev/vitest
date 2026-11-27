import type { Task, TaskPopulated, Test } from './types'

let _test: Test | undefined

export function setCurrentTest<T extends Test>(test: T | undefined): void {
  _test = test
}

export function getCurrentTest<T extends Test | undefined>(): T {
  return _test as T
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

// the search runs that only check a smaller input report no logs, annotations or artifacts
const shrinkSearchRuns = new WeakSet<Task | TaskPopulated>()
let lastShrinkSearchRun: Test | undefined
export function setShrinkSearchRun(test: Test, active: boolean): void {
  if (active) {
    shrinkSearchRuns.add(test)
    lastShrinkSearchRun = test
  } else {
    shrinkSearchRuns.delete(test)
  }
}

export function isShrinkSearchRun(task: Task | TaskPopulated | undefined): boolean {
  return !!task && shrinkSearchRuns.has(task)
}

// a hidden run can throw an error after it ends, also while the next tests run
export function getLastShrinkSearchRun(filepath: string | undefined): Test | undefined {
  return lastShrinkSearchRun?.file.filepath === filepath ? lastShrinkSearchRun : undefined
}
