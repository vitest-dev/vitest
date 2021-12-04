import { context } from './context'
import { Task, SuiteCollector, RunMode, TestFactory, TestFunction, File, Suite } from './types'

export const defaultSuite = suite('')

function getCurrentSuite() {
  return context.currentSuite || defaultSuite
}

export const test = (name: string, fn: TestFunction) => getCurrentSuite().test(name, fn)
test.skip = (name: string, fn: TestFunction) => getCurrentSuite().test.skip(name, fn)
test.only = (name: string, fn: TestFunction) => getCurrentSuite().test.only(name, fn)
test.todo = (name: string) => getCurrentSuite().test.todo(name)

function createSuiteCollector(mode: RunMode, suiteName: string, factory?: TestFactory) {
  const queue: Task[] = []
  const factoryQueue: Task[] = []

  const collector: SuiteCollector = {
    name: suiteName,
    mode,
    test,
    collect,
    clear,
  }

  function collectTask(name: string, fn: TestFunction, mode: RunMode) {
    queue.push({
      name,
      mode,
      suite: {} as Suite,
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

  async function collect(file?: File) {
    factoryQueue.length = 0
    if (factory)
      await factory(test)

    const tasks = [...factoryQueue, ...queue]

    const suite: Suite = {
      name: collector.name,
      mode: collector.mode,
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

export function suite(suiteName: string, factory?: TestFactory) {
  return createSuiteCollector('run', suiteName, factory)
}
suite.skip = (suiteName: string, factory?: TestFactory) => createSuiteCollector('skip', suiteName, factory)
suite.only = (suiteName: string, factory?: TestFactory) => createSuiteCollector('only', suiteName, factory)
suite.todo = (suiteName: string) => createSuiteCollector('todo', suiteName)

// alias
export const describe = suite
export const it = test

// utils
export function clearContext() {
  context.suites.length = 0
  defaultSuite.clear()
  context.currentSuite = defaultSuite
}
