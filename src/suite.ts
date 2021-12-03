import { context } from './context'
import { Task, Suite, SuiteMode, TestFactory } from './types'

export const defaultSuite = suite('')
export const test = (name: string, fn: () => Promise<void> | void) => (context.currentSuite || defaultSuite).test(name, fn)

export function clearContext() {
  context.suites.length = 0
  defaultSuite.clear()
}

function processSuite(mode: SuiteMode, suiteName: string, factory?: TestFactory) {
  const queue: Task[] = []
  const factoryQueue: Task[] = []

  const suite: Suite = {
    name: suiteName,
    mode,
    test,
    collect,
    clear,
  }

  function test(name: string, fn: () => Promise<void> | void) {
    const task: Task = {
      suite,
      name,
      fn,
    }
    queue.push(task)
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
  return processSuite('run', suiteName, factory)
}

suite.skip = function skip(suiteName: string, factory?: TestFactory) {
  return processSuite('skip', suiteName, factory)
}

suite.only = function skip(suiteName: string, factory?: TestFactory) {
  return processSuite('only', suiteName, factory)
}

suite.todo = function skip(suiteName: string) {
  return processSuite('todo', suiteName)
}

// alias
export const describe = suite
export const it = test
