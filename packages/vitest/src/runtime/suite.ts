import { nanoid } from 'nanoid/non-secure'
import type { Awaitable, ComputeMode, File, ModuleCache, ResolvedConfig, RpcCall, RpcSend, RunMode, Suite, SuiteCollector, SuiteHooks, Test, TestCollector, TestFactory, TestFunction } from '../types'
import { collectTask, context, normalizeTest, runWithSuite } from './context'
import { getHooks, setFn, setHooks } from './map'

export const suite = createSuite()

export const defaultSuite = suite('')

export function clearContext() {
  context.tasks.length = 0
  defaultSuite.clear()
  context.currentSuite = defaultSuite
}

export function getCurrentSuite() {
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
  const tasks: (Test | Suite | SuiteCollector)[] = []
  const factoryQueue: (Test | Suite | SuiteCollector)[] = []

  let suite: Suite

  initSuite()

  const test = createTestCollector((name: string, fn: () => Awaitable<void>, mode: RunMode, computeMode?: ComputeMode) => {
    const test: Test = {
      id: nanoid(),
      type: 'test',
      name,
      mode,
      computeMode: computeMode ?? (suiteComputeMode ?? 'serial'),
      suite: undefined!,
    }
    setFn(test, fn)
    tasks.push(test)
  })

  const collector: SuiteCollector = {
    type: 'collector',
    name,
    mode,
    test,
    tasks,
    collect,
    clear,
    on: addHook,
  }

  function addHook<T extends keyof SuiteHooks>(name: T, ...fn: SuiteHooks[T]) {
    getHooks(suite)[name].push(...fn as any)
  }

  function initSuite() {
    suite = {
      id: nanoid(),
      type: 'suite',
      computeMode: 'serial',
      name,
      mode,
      tasks: [],
    }
    setHooks(suite, createSuiteHooks())
  }

  function clear() {
    tasks.length = 0
    factoryQueue.length = 0
    initSuite()
  }

  async function collect(file?: File) {
    factoryQueue.length = 0
    if (factory)
      await runWithSuite(collector, () => factory(test))

    const allChildren = await Promise.all(
      [...factoryQueue, ...tasks]
        .map(i => i.type === 'collector' ? i.collect(file) : i),
    )

    suite.file = file
    suite.tasks = allChildren

    allChildren.forEach((task) => {
      task.suite = suite
      if (file)
        task.file = file
    })

    return suite
  }

  collectTask(collector)

  return collector
}

function createTestCollector(collectTest: (name: string, fn: () => Awaitable<void>, mode: RunMode, computeMode?: ComputeMode) => void): TestCollector {
  function test(name: string, fn: TestFunction, timeout?: number) {
    collectTest(name, normalizeTest(fn, timeout), 'run')
  }
  test.concurrent = concurrent
  test.skip = skip
  test.only = only
  test.todo = todo
  function concurrent(name: string, fn: TestFunction, timeout?: number) {
    collectTest(name, normalizeTest(fn, timeout), 'run', 'concurrent')
  }
  concurrent.skip = (name: string, fn: TestFunction, timeout?: number) => collectTest(name, normalizeTest(fn, timeout), 'skip', 'concurrent')
  concurrent.only = (name: string, fn: TestFunction, timeout?: number) => collectTest(name, normalizeTest(fn, timeout), 'only', 'concurrent')
  concurrent.todo = todo
  function skip(name: string, fn: TestFunction, timeout?: number) {
    collectTest(name, normalizeTest(fn, timeout), 'skip')
  }
  skip.concurrent = concurrent.skip
  function only(name: string, fn: TestFunction, timeout?: number) {
    collectTest(name, normalizeTest(fn, timeout), 'only')
  }
  only.concurrent = concurrent.only
  function todo(name: string) {
    collectTest(name, () => { }, 'todo')
  }
  todo.concurrent = todo

  return test
}

// apis
export const test = (function() {
  function test(name: string, fn: TestFunction, timeout?: number) {
    return getCurrentSuite().test(name, fn, timeout)
  }
  function concurrent(name: string, fn: TestFunction, timeout?: number) {
    return getCurrentSuite().test.concurrent(name, fn, timeout)
  }

  concurrent.skip = (name: string, fn: TestFunction, timeout?: number) => getCurrentSuite().test.concurrent.skip(name, fn, timeout)
  concurrent.only = (name: string, fn: TestFunction, timeout?: number) => getCurrentSuite().test.concurrent.only(name, fn, timeout)
  concurrent.todo = (name: string) => getCurrentSuite().test.concurrent.todo(name)

  function skip(name: string, fn: TestFunction, timeout?: number) {
    return getCurrentSuite().test.skip(name, fn, timeout)
  }
  skip.concurrent = (name: string, fn: TestFunction, timeout?: number) => getCurrentSuite().test.skip.concurrent(name, fn, timeout)
  function only(name: string, fn: TestFunction, timeout?: number) {
    return getCurrentSuite().test.only(name, fn, timeout)
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

declare global {
  namespace NodeJS {
    interface Process {
      __vitest_worker__: {
        config: ResolvedConfig
        rpc: RpcCall
        send: RpcSend
        current?: Test
        filepath?: string
        moduleCache: Map<string, ModuleCache>
      }
    }
  }
}
