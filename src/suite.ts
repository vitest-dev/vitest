import { context } from './context'
import { Task, SuiteCollector, RunMode, TestFactory, TestFunction, File, Suite } from './types'

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

  function collectTask(name: string, fn: TestFunction, mode: RunMode) {
    queue.push({
      name,
      mode,
      suite: {} as Suite,
      state: (mode !== 'run' && mode !== 'only') ? mode : undefined,
      fn,
    })
  }

  function test(name: string, fn: TestFunction) {
    collectTask(name, fn, 'run')
  }
  test.skip = (name: string, fn: TestFunction) => collectTask(name, fn, 'skip')
  test.only = (name: string, fn: TestFunction) => collectTask(name, fn, 'only')
  test.todo = (name: string) => collectTask(name, () => { }, 'todo')

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

// apis
export const test = (name: string, fn: TestFunction) => getCurrentSuite().test(name, fn)
test.skip = (name: string, fn: TestFunction) => getCurrentSuite().test.skip(name, fn)
test.only = (name: string, fn: TestFunction) => getCurrentSuite().test.only(name, fn)
test.todo = (name: string) => getCurrentSuite().test.todo(name)

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
