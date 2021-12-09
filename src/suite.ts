import { context } from './context'
import { getHooks, setFn, setHooks } from './map'
import { Task, SuiteCollector, TestCollector, RunMode, ComputeMode, TestFactory, TestFunction, File, Suite, SuiteHooks } from './types'

export const suite = createSuite()

export const defaultSuite = suite('')

function getCurrentSuite() {
  return context.currentSuite || defaultSuite
}

export function createSuiteHooks() {
  return {
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  }
}

function createSuiteCollector(name: string, factory: TestFactory = () => { }, mode: RunMode, suiteComputeMode?: ComputeMode) {
  const children: (Task | Suite | SuiteCollector)[] = []
  const factoryQueue: (Task | Suite |SuiteCollector)[] = []

  let suite: Suite

  initSuite()

  const test = createTestCollector((name: string, fn: TestFunction, mode: RunMode, computeMode?: ComputeMode) => {
    const task: Task = {
      type: 'task',
      name,
      mode,
      computeMode: computeMode ?? (suiteComputeMode ?? 'serial'),
      suite: {} as Suite,
      state: (mode !== 'run' && mode !== 'only') ? mode : undefined,
    }
    setFn(task, fn)
    children.push(task)
  })

  const collector: SuiteCollector = {
    type: 'collector',
    name,
    mode,
    test,
    children,
    collect,
    clear,
    on: addHook,
  }

  function addHook<T extends keyof SuiteHooks>(name: T, ...fn: SuiteHooks[T]) {
    getHooks(suite)[name].push(...fn as any)
  }

  function initSuite() {
    suite = {
      type: 'suite',
      computeMode: 'serial',
      name,
      mode,
      children: [],
    }
    setHooks(suite, createSuiteHooks())
  }

  function clear() {
    children.length = 0
    factoryQueue.length = 0
    initSuite()
  }

  async function collect(file?: File) {
    factoryQueue.length = 0
    if (factory) {
      const prev = context.currentSuite
      context.currentSuite = collector
      await factory(test)
      context.currentSuite = prev
    }

    const allChildren = await Promise.all(
      [...factoryQueue, ...children]
        .map(i => i.type === 'collector' ? i.collect(file) : i),
    )

    suite.file = file
    suite.children = allChildren

    allChildren.forEach((task) => {
      if (task.type === 'task') {
        task.suite = suite
        if (file)
          task.file = file
      }
    })

    return suite
  }

  context.currentSuite?.children.push(collector)

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
  context.children.length = 0
  defaultSuite.clear()
  context.currentSuite = defaultSuite
}

export function getSuiteTasks(suite: Suite): Task[] {
  return suite.children.flatMap(c => c.type === 'task' ? [c] : getSuiteTasks(c))
}

export function suiteHasTasks(suite: Suite): boolean {
  return suite.children.some(c => c.type === 'task' || suiteHasTasks(c as Suite))
}
