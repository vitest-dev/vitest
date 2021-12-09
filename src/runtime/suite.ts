import { nanoid } from 'nanoid'
import { SuiteHooks, Task, SuiteCollector, TestCollector, RunMode, ComputeMode, TestFactory, TestFunction, Suite } from '../types'
import { context } from './context'
import { getHooks, setFn, setHooks } from './map'

export const suite = createSuite()

export const defaultSuite = suite('')

function getCurrentSuite() {
  return context.currentSuite || defaultSuite
}

function createSuiteCollector(name: string, factory: TestFactory = () => {}, mode: RunMode, suiteComputeMode?: ComputeMode) {
  const queue: Task[] = []
  const factoryQueue: Task[] = []

  const suite: Suite = {
    name,
    mode,
    tasks: [],
  }

  setHooks(suite, {
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  })

  const test = createTestCollector((name: string, fn: TestFunction, mode: RunMode, computeMode?: ComputeMode) => {
    const task: Task = {
      id: nanoid(),
      name,
      mode,
      computeMode: computeMode ?? (suiteComputeMode ?? 'serial'),
      suite: {} as Suite,
    }
    setFn(task, fn)
    queue.push(task)
  })

  const collector: SuiteCollector = {
    name,
    mode,
    test,
    collect,
    clear,
    on: addHook,
  }

  function addHook<T extends keyof SuiteHooks>(name: T, ...fn: SuiteHooks[T]) {
    getHooks(suite)[name].push(...fn as any)
  }

  function clear() {
    queue.length = 0
    factoryQueue.length = 0
  }

  async function collect() {
    factoryQueue.length = 0
    if (factory)
      await factory(test)

    const tasks = [...factoryQueue, ...queue]

    suite.tasks = tasks
    tasks.forEach(task => task.suite = suite)

    return suite
  }

  context.currentSuite = collector
  context.suites.push(collector)

  return collector
}

function createTestCollector(collectTask: (name: string, fn: TestFunction, mode: RunMode, computeMode?: ComputeMode) => void): TestCollector {
  function test(name: string, fn: TestFunction) {
    collectTask(name, fn, 'run')
  }
  test.concurrent = concurrent
  test.skip = skip
  test.only = only
  test.todo = todo
  function concurrent(name: string, fn: TestFunction) {
    collectTask(name, fn, 'run', 'concurrent')
  }
  concurrent.skip = (name: string, fn: TestFunction) => collectTask(name, fn, 'skip', 'concurrent')
  concurrent.only = (name: string, fn: TestFunction) => collectTask(name, fn, 'only', 'concurrent')
  concurrent.todo = todo
  function skip(name: string, fn: TestFunction) {
    collectTask(name, fn, 'skip')
  }
  skip.concurrent = concurrent.skip
  function only(name: string, fn: TestFunction) {
    collectTask(name, fn, 'only')
  }
  only.concurrent = concurrent.only
  function todo(name: string) {
    collectTask(name, () => { }, 'todo')
  }
  todo.concurrent = todo

  return test
}

// apis

export const test = (function() {
  function test(name: string, fn: TestFunction) {
    return getCurrentSuite().test(name, fn)
  }
  function concurrent(name: string, fn: TestFunction) {
    return getCurrentSuite().test.concurrent(name, fn)
  }

  concurrent.skip = (name: string, fn: TestFunction) => getCurrentSuite().test.concurrent.skip(name, fn)
  concurrent.only = (name: string, fn: TestFunction) => getCurrentSuite().test.concurrent.only(name, fn)
  concurrent.todo = (name: string) => getCurrentSuite().test.concurrent.todo(name)

  function skip(name: string, fn: TestFunction) {
    return getCurrentSuite().test.skip(name, fn)
  }
  skip.concurrent = (name: string, fn: TestFunction) => getCurrentSuite().test.skip.concurrent(name, fn)
  function only(name: string, fn: TestFunction) {
    return getCurrentSuite().test.only(name, fn)
  }
  only.concurrent = (name: string, fn: TestFunction) => getCurrentSuite().test.only.concurrent(name, fn)
  function todo(name: string) {
    return getCurrentSuite().test.todo(name)
  }
  todo.concurrent = (name: string) => getCurrentSuite().test.todo.concurrent(name)

  test.concurrent = concurrent
  test.skip = skip
  test.only = only
  test.todo = todo

  return test
})()

function createSuite() {
  function suite(suiteName: string, factory?: TestFactory) {
    return createSuiteCollector(suiteName, factory, 'run')
  }
  function concurrent(suiteName: string, factory?: TestFactory) {
    return createSuiteCollector(suiteName, factory, 'run', 'concurrent')
  }
  concurrent.skip = (suiteName: string, factory?: TestFactory) => createSuiteCollector(suiteName, factory, 'skip', 'concurrent')
  concurrent.only = (suiteName: string, factory?: TestFactory) => createSuiteCollector(suiteName, factory, 'only', 'concurrent')
  concurrent.todo = (suiteName: string) => createSuiteCollector(suiteName, undefined, 'todo')

  function skip(suiteName: string, factory?: TestFactory) {
    return createSuiteCollector(suiteName, factory, 'skip')
  }
  skip.concurrent = concurrent.skip

  function only(suiteName: string, factory?: TestFactory) {
    return createSuiteCollector(suiteName, factory, 'only')
  }
  only.concurrent = concurrent.only

  function todo(suiteName: string) {
    return createSuiteCollector(suiteName, undefined, 'todo')
  }
  todo.concurrent = concurrent.todo

  suite.concurrent = concurrent
  suite.skip = skip
  suite.only = only
  suite.todo = todo
  return suite
}

// alias
export const describe = suite
export const it = test

// hooks
export const beforeAll = (fn: SuiteHooks['beforeAll'][0]) => getCurrentSuite().on('beforeAll', fn)
export const afterAll = (fn: SuiteHooks['afterAll'][0]) => getCurrentSuite().on('afterAll', fn)
export const beforeEach = (fn: SuiteHooks['beforeEach'][0]) => getCurrentSuite().on('beforeEach', fn)
export const afterEach = (fn: SuiteHooks['afterEach'][0]) => getCurrentSuite().on('afterEach', fn)

// utils
export function clearContext() {
  context.suites.length = 0
  defaultSuite.clear()
  context.currentSuite = defaultSuite
}
