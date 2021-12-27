import type { ComputeMode, File, RunMode, Suite, SuiteCollector, SuiteHooks, Test, TestCollector, TestFactory, TestFunction } from '../types'
import { noop } from '../utils'
import { createChainable } from './chain'
import { collectTask, context, normalizeTest, runWithSuite } from './context'
import { getHooks, setFn, setHooks } from './map'

// apis
export const suite = createSuite()
export const test: TestCollector = createChainable(
  ['concurrent', 'skip', 'only', 'todo', 'fails'],
  function(name: string, fn?: TestFunction, timeout?: number) {
    // @ts-expect-error untyped internal prop
    getCurrentSuite().test.fn.call(this, name, fn, timeout)
  },
)

// alias
export const describe = suite
export const it = test

// implementations
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

  const test = createChainable(
    ['concurrent', 'skip', 'only', 'todo', 'fails'],
    function(name: string, fn?: TestFunction, timeout?: number) {
      const mode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'
      const computeMode = this.concurrent ? 'concurrent' : undefined

      const test: Test = {
        id: '',
        type: 'test',
        name,
        mode,
        computeMode: computeMode ?? (suiteComputeMode ?? 'serial'),
        suite: undefined!,
        fails: this.fails,
      }
      setFn(test, normalizeTest(fn || noop, timeout))
      tasks.push(test)
    },
  )

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
      id: '',
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

function createSuite() {
  return createChainable(
    ['concurrent', 'skip', 'only', 'todo'],
    function(name: string, factory?: TestFactory) {
      const mode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'
      const computeMode = this.concurrent ? 'concurrent' : undefined
      return createSuiteCollector(name, factory, mode, computeMode)
    },
  )
}
