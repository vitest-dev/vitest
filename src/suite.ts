import { context } from './context'
import { Task, Suite, RunMode, TestFactory, TestFunction } from './types'

export const defaultSuite = suite('')
export const test = (name: string, fn: TestFunction) => (context.currentSuite || defaultSuite).test(name, fn)
test.skip = function skip(name: string, fn: TestFunction) {
  (context.currentSuite || defaultSuite).test.skip(name, fn)
}
test.only = function only(name: string, fn: TestFunction) {
  (context.currentSuite || defaultSuite).test.only(name, fn)
}
test.todo = function todo(name: string) {
  (context.currentSuite || defaultSuite).test.todo(name)
}

export function clearContext() {
  context.suites.length = 0
  defaultSuite.clear()
  context.currentSuite = defaultSuite
}

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

  function createTask(mode: RunMode, name: string, fn: TestFunction) {
    const task: Task = {
      suite,
      mode,
      name,
      status: 'init',
      fn,
    }
    queue.push(task)
  }

  function test(name: string, fn: TestFunction) {
    createTask(mode, name, fn)
  }
  test.skip = function skip(name: string, fn: TestFunction) {
    createTask('skip', name, fn)
  }
  test.only = function only(name: string, fn: TestFunction) {
    createTask('only', name, fn)
  }
  test.todo = function todo(name: string) {
    createTask('todo', name, () => { })
  }

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

suite.skip = function skip(suiteName: string, factory?: TestFactory) {
  return createSuite('skip', suiteName, factory)
}

suite.only = function skip(suiteName: string, factory?: TestFactory) {
  return createSuite('only', suiteName, factory)
}

suite.todo = function skip(suiteName: string) {
  return createSuite('todo', suiteName)
}

// alias
export const describe = suite
export const it = test
