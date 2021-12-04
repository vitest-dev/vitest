import { context } from './context'
import { Task, Suite, RunMode, TestFactory, TestFunction } from './types'

export const defaultSuite = suite('')

function getCurrentSuite() {
  return context.currentSuite || defaultSuite
}

export const test = (name: string, fn: TestFunction) => getCurrentSuite().test(name, fn)
test.skip = (name: string, fn: TestFunction) => getCurrentSuite().test.skip(name, fn)
test.only = (name: string, fn: TestFunction) => getCurrentSuite().test.only(name, fn)
test.todo = (name: string) => getCurrentSuite().test.todo(name)

function createSuite(mode: RunMode, suiteName: string, factory?: TestFactory) {
  const queue: Task[] = []
  const factoryQueue: Task[] = []

  const suite: Suite = {
    name: suiteName,
    mode,
    test,
    collect,
    clear,
  }

  function collectTask(name: string, fn: TestFunction, mode: RunMode) {
    queue.push({
      suite,
      mode,
      name,
      status: 'init',
      fn,
    })
  }

  function test(name: string, fn: TestFunction) {
    collectTask(name, fn, mode)
  }
  test.skip = (name: string, fn: TestFunction) => collectTask(name, fn, 'skip')
  test.only = (name: string, fn: TestFunction) => collectTask(name, fn, 'only')
  test.todo = (name: string) => collectTask(name, () => { }, 'todo')

  function clear() {
    queue.length = 0
    factoryQueue.length = 0
  }

  async function collect() {
    factoryQueue.length = 0
    if (factory)
      await factory(test)
    return [...factoryQueue, ...queue]
  }

  context.currentSuite = suite
  context.suites.push(suite)

  return suite
}

export function suite(suiteName: string, factory?: TestFactory) {
  return createSuite('run', suiteName, factory)
}
suite.skip = (suiteName: string, factory?: TestFactory) => createSuite('skip', suiteName, factory)
suite.only = (suiteName: string, factory?: TestFactory) => createSuite('only', suiteName, factory)
suite.todo = (suiteName: string) => createSuite('todo', suiteName)

// alias
export const describe = suite
export const it = test

// utils
export function clearContext() {
  context.suites.length = 0
  defaultSuite.clear()
  context.currentSuite = defaultSuite
}
