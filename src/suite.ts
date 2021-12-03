import { context } from './context'
import { Task, Suite } from './types'

export const defaultSuite = suite('')
export const test = (name: string, fn: () => Promise<void> | void) => defaultSuite.test(name, fn)

export function clearContext() {
  context.suites.length = 0
  defaultSuite.clear()
}

export function suite(suiteName: string, factory?: (test: Suite['test']) => Promise<void> | void) {
  const queue: Task[] = []
  const factoryQueue: Task[] = []

  const suite: Suite = {
    name: suiteName,
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

// alias
export const describe = suite
export const it = test
