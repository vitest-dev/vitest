import { format } from 'util'
import type { BenchFunction, Benchmark, BenchmarkAPI, BenchmarkOptions, File, RunMode, Suite, SuiteAPI, SuiteCollector, SuiteFactory, SuiteHooks, Task, Test, TestAPI, TestFunction } from '../types'
import { isObject, noop, toArray } from '../utils'
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
export const benchmark = createBenchmark(
  function (name, fn, options) {
    // @ts-expect-error untyped internal prop
    getCurrentSuite().benchmark.fn.call(this, name, fn, options)
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
  let formatted = format(template, ...items.slice(0, count))
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

// implementations
export const defaultSuite = suite('')

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

function createSuiteCollector(name: string, factory: SuiteFactory = () => { }, mode: RunMode, concurrent?: boolean) {
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

  const benchmark = createBenchmark((name: string, fn = noop, options: BenchmarkOptions) => {
    const benchmark: Benchmark = {
      type: 'benchmark',
      id: '',
      name,
      mode: 'run',
      options,
      suite: undefined!,
    }

    setFn(benchmark, fn)
  })

  const collector: SuiteCollector = {
    type: 'collector',
    name,
    mode,
    test,
    tasks,
    benchmark,
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
  const suite = createChainable(
    ['concurrent', 'skip', 'only', 'todo'],
    function (name: string, factory?: SuiteFactory) {
      const mode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'
      return createSuiteCollector(name, factory, mode, this.concurrent)
    },
  ) as SuiteAPI

  suite.each = <T>(cases: ReadonlyArray<T>) => {
    return (name: string, fn: (...args: T[]) => void) => {
      cases.forEach((i, idx) => {
        const items = toArray(i) as any
        suite(formatTitle(name, items, idx), () => fn(...items))
      })
    }
  }

  suite.skipIf = (condition: any) => (condition ? suite.skip : suite) as SuiteAPI
  suite.runIf = (condition: any) => (condition ? suite : suite.skip) as SuiteAPI

  return suite
}

function createTest(fn: (
  (
    this: Record<'concurrent' | 'skip' | 'only' | 'todo' | 'fails', boolean | undefined>,
    title: string,
    fn?: TestFunction,
    timeout?: number
  ) => void
)) {
  const test = createChainable(
    ['concurrent', 'skip', 'only', 'todo', 'fails'],
    fn,
  ) as TestAPI

  test.each = <T>(cases: ReadonlyArray<T>) => {
    return (name: string, fn: (...args: T[]) => void) => {
      cases.forEach((i, idx) => {
        const items = toArray(i) as any
        test(formatTitle(name, items, idx), () => fn(...items))
      })
    }
  }

  test.skipIf = (condition: any) => (condition ? test.skip : test) as TestAPI
  test.runIf = (condition: any) => (condition ? test : test.skip) as TestAPI

  return test as TestAPI
}

function createBenchmark(fn: (
  (
    this: Record<'skip', boolean | undefined>,
    name: string,
    fn: BenchFunction,
    options: BenchmarkOptions
  ) => void
)) {
  const benchmark = createChainable(
    ['skip'],
    fn,
  ) as BenchmarkAPI

  benchmark.skipIf = (condition: any) => (condition ? benchmark.skip : benchmark) as BenchmarkAPI
  benchmark.runIf = (condition: any) => (condition ? benchmark : benchmark.skip) as BenchmarkAPI

  return benchmark as BenchmarkAPI
}
