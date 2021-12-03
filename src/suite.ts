import { Task, Suite, GlobalContext } from './types'

export const context: GlobalContext = {
  suites: [],
}
export const defaultSuite = suite('')
export const test = defaultSuite.test

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
  }

  context.suites.push(suite)

  return suite
}

// alias
export const describe = suite
export const it = test
