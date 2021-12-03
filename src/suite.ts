import { Task, Suite, GlobalContext } from './types'

export const context: GlobalContext = {
  suites: [],
}
export const defaultSuite = suite('')
export const test = defaultSuite.test

export function clearContext() {
  context.suites.length = 0
  defaultSuite.clear()
}

export function suite(suiteName: string, factory?: (test: Suite['test']) => Promise<void> | void) {
  const queue: Task[] = []
  const factoryQueue: Task[] = []

  function test(name: string, run: () => Promise<void> | void) {
    const task: Task = {
      name,
      run,
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

  const suite: Suite = {
    name: suiteName,
    test,
    collect,
    clear,
  }

  context.suites.push(suite)

  return suite
}

// alias
export const describe = suite
export const it = test
