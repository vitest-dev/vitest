import util from 'util'
import type { File, RunMode, Suite, SuiteAPI, SuiteCollector, SuiteFactory, SuiteHooks, Task, Test, TestAPI, TestFunction } from '../types'
import { getWorkerState, isObject, noop } from '../utils'
import { createChainable } from './chain'
import { collectTask, collectorContext, createTestContext, runWithSuite, withTimeout } from './context'
import { getHooks, setFn, setHooks } from './map'

// apis
export const suite = createSuite()
export const test = createTest(
  function (name: string, fn?: TestFunction, timeout?: number) {
    // @ts-expect-error untyped internal prop
    getCurrentSuite().test.fn.call(this, name, fn, timeout)
  },
)

function formatTitle(template: string, items: any[], idx: number) {
  if (template.includes('%#')) {
    // '%#' match index of the test case
    template = template
      .replace(/%%/g, '__vitest_escaped_%__')
      .replace(/%#/g, `${idx}`)
      .replace(/__vitest_escaped_%__/g, '%%')
  }

  const count = template.split('%').length - 1
  let formatted = util.format(template, ...items.slice(0, count))
  if (isObject(items[0])) {
    formatted = formatted.replace(/\$([$\w_]+)/g, (_, key) => {
      return items[0][key]
    })
  }
  return formatted
}

// alias
export const describe = suite
export const it = test

const workerState = getWorkerState()

// implementations
export const defaultSuite = workerState.config.sequence.shuffle
  ? suite.shuffle('')
  : suite('')

export function clearCollectorContext() {
  collectorContext.tasks.length = 0
  defaultSuite.clear()
  collectorContext.currentSuite = defaultSuite
}

export function getCurrentSuite() {
  return collectorContext.currentSuite || defaultSuite
}

export function createSuiteHooks() {
  return {
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  }
}

function createSuiteCollector(name: string, factory: SuiteFactory = () => { }, mode: RunMode, concurrent?: boolean, shuffle?: boolean) {
  const tasks: (Test | Suite | SuiteCollector)[] = []
  const factoryQueue: (Test | Suite | SuiteCollector)[] = []

  let suite: Suite

  initSuite()

  const test = createTest(function (name: string, fn = noop, timeout?: number) {
    const mode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'

    const test: Test = {
      id: '',
      type: 'test',
      name,
      mode,
      suite: undefined!,
      fails: this.fails,
    } as Omit<Test, 'context'> as Test
    if (this.concurrent || concurrent)
      test.concurrent = true
    if (shuffle)
      test.shuffle = true

    const context = createTestContext(test)
    // create test context
    Object.defineProperty(test, 'context', {
      value: context,
      enumerable: false,
    })

    setFn(test, withTimeout(
      () => fn(context),
      timeout,
    ))

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
      id: '',
      type: 'suite',
      name,
      mode,
      shuffle,
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

    const allChildren: Task[] = []

    for (const i of [...factoryQueue, ...tasks])
      allChildren.push(i.type === 'collector' ? await i.collect(file) : i)

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
  function suiteFn(this: Record<string, boolean | undefined>, name: string, factory?: SuiteFactory) {
    const mode: RunMode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'
    return createSuiteCollector(name, factory, mode, this.concurrent, this.shuffle)
  }

  suiteFn.each = function<T>(this: { withContext: () => SuiteAPI }, cases: ReadonlyArray<T>) {
    const suite = this.withContext()
    return (name: string, fn: (...args: T[]) => void) => {
      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]
        suite(formatTitle(name, items, idx), () => fn(...items))
      })
    }
  }

  suiteFn.skipIf = (condition: any) => (condition ? suite.skip : suite) as SuiteAPI
  suiteFn.runIf = (condition: any) => (condition ? suite : suite.skip) as SuiteAPI

  return createChainable(
    ['concurrent', 'shuffle', 'skip', 'only', 'todo'],
    suiteFn,
  ) as unknown as SuiteAPI
}

function createTest(fn: (
  (
    this: Record<'concurrent' | 'skip' | 'only' | 'todo' | 'fails', boolean | undefined>,
    title: string,
    fn?: TestFunction,
    timeout?: number
  ) => void
)) {
  const testFn = fn as any

  testFn.each = function<T>(this: { withContext: () => TestAPI }, cases: ReadonlyArray<T>) {
    const test = this.withContext()

    return (name: string, fn: (...args: T[]) => void, timeout?: number) => {
      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]
        test(formatTitle(name, items, idx), () => fn(...items), timeout)
      })
    }
  }

  testFn.skipIf = (condition: any) => (condition ? test.skip : test) as TestAPI
  testFn.runIf = (condition: any) => (condition ? test : test.skip) as TestAPI

  return createChainable(
    ['concurrent', 'skip', 'only', 'todo', 'fails'],
    testFn,
  ) as TestAPI
}
