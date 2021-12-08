import { context } from './context'
import { Task, SuiteCollector, TestCollector, RunMode, ConcurrentOptions, TestFactory, TestFunction, File, Suite } from './types'
import { defaultConcurrentTimeout } from './constants'

export const defaultSuite = suite('')

function getCurrentSuite() {
  return context.currentSuite || defaultSuite
}

function createSuiteCollector(name: string, factory: TestFactory = () => {}, mode: RunMode) {
  const queue: Task[] = []
  const factoryQueue: Task[] = []

  const suiteBase: Pick<Suite, 'name' | 'mode' | 'hooks'> = {
    name,
    mode,
    hooks: {
      beforeAll: [],
      afterAll: [],
      beforeEach: [],
      afterEach: [],
    },
  }

  const test = createTestCollector((name: string, fn: TestFunction, mode: RunMode, concurrent?: ConcurrentOptions) => {
    queue.push({
      name,
      mode,
      concurrent,
      suite: {} as Suite,
      state: (mode !== 'run' && mode !== 'only') ? mode : undefined,
      fn,
    })
  })

  const collector: SuiteCollector = {
    name,
    mode,
    test,
    collect,
    clear,
    on: addHook,
  }

  function addHook<T extends keyof Suite['hooks']>(name: T, ...fn: Suite['hooks'][T]) {
    suiteBase.hooks[name].push(...fn as any)
  }

  function clear() {
    queue.length = 0
    factoryQueue.length = 0
  }

  async function collect(file?: File) {
    factoryQueue.length = 0
    if (factory)
      await factory(test)

    const tasks = [...factoryQueue, ...queue]

    const suite: Suite = {
      ...suiteBase,
      tasks,
      file,
    }

    tasks.forEach((task) => {
      task.suite = suite
      if (file)
        task.file = file
    })

    return suite
  }

  context.currentSuite = collector
  context.suites.push(collector)

  return collector
}

function createConcurrentOptions(timeout?: number) {
  return { timeout: timeout ?? defaultConcurrentTimeout }
}

function createTestCollector(collectTask: (name: string, fn: TestFunction, mode: RunMode, concurrent?: ConcurrentOptions) => void): TestCollector {
  function test(name: string, fn: TestFunction) {
    collectTask(name, fn, 'run')
  }
  test.concurrent = concurrent
  test.skip = skip
  test.only = only
  test.todo = todo
  function concurrent(name: string, fn: TestFunction, timeout?: number) {
    collectTask(name, fn, 'run', createConcurrentOptions(timeout))
  }
  concurrent.skip = (name: string, fn: TestFunction, timeout?: number) => collectTask(name, fn, 'skip', createConcurrentOptions(timeout))
  concurrent.only = (name: string, fn: TestFunction, timeout?: number) => collectTask(name, fn, 'only', createConcurrentOptions(timeout))
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
  function concurrent(name: string, fn: TestFunction, timeout?: number) {
    return getCurrentSuite().test.concurrent(name, fn, timeout)
  }

  concurrent.skip = (name: string, fn: TestFunction, timeout?: number) => getCurrentSuite().test.concurrent.skip(name, fn, timeout)
  concurrent.only = (name: string, fn: TestFunction, timeout?: number) => getCurrentSuite().test.concurrent.only(name, fn, timeout)
  concurrent.todo = (name: string) => getCurrentSuite().test.concurrent.todo(name)

  function skip(name: string, fn: TestFunction) {
    return getCurrentSuite().test.skip(name, fn)
  }
  skip.concurrent = (name: string, fn: TestFunction, timeout?: number) => getCurrentSuite().test.skip.concurrent(name, fn, timeout)
  function only(name: string, fn: TestFunction) {
    return getCurrentSuite().test.only(name, fn)
  }
  only.concurrent = (name: string, fn: TestFunction, timeout?: number) => getCurrentSuite().test.only.concurrent(name, fn, timeout)
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

export function suite(suiteName: string, factory?: TestFactory) {
  return createSuiteCollector(suiteName, factory, 'run')
}
suite.skip = (suiteName: string, factory?: TestFactory) => createSuiteCollector(suiteName, factory, 'skip')
suite.only = (suiteName: string, factory?: TestFactory) => createSuiteCollector(suiteName, factory, 'only')
suite.todo = (suiteName: string) => createSuiteCollector(suiteName, undefined, 'todo')

// alias
export const describe = suite
export const it = test

// hooks
export const beforeAll = (fn: Suite['hooks']['beforeAll'][0]) => getCurrentSuite().on('beforeAll', fn)
export const afterAll = (fn: Suite['hooks']['afterAll'][0]) => getCurrentSuite().on('afterAll', fn)
export const beforeEach = (fn: Suite['hooks']['beforeEach'][0]) => getCurrentSuite().on('beforeEach', fn)
export const afterEach = (fn: Suite['hooks']['afterEach'][0]) => getCurrentSuite().on('afterEach', fn)

// utils
export function clearContext() {
  context.suites.length = 0
  defaultSuite.clear()
  context.currentSuite = defaultSuite
}
