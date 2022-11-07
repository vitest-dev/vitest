import util from 'util'
import type { BenchFunction, BenchOptions, Benchmark, BenchmarkAPI, File, RunMode, Suite, SuiteAPI, SuiteCollector, SuiteFactory, SuiteHooks, Task, Test, TestAPI, TestFunction, TestOptions } from '../types'
import { getWorkerState, isObject, isRunningInBenchmark, isRunningInTest, noop } from '../utils'
import { createChainable } from './chain'
import { collectTask, collectorContext, createTestContext, runWithSuite, withTimeout } from './context'
import { getHooks, setFn, setHooks } from './map'

// apis
export const suite = createSuite()
export const test = createTest(
  function (name: string, fn?: TestFunction, options?: number | TestOptions) {
    getCurrentSuite().test.fn.call(this, name, fn, options)
  },
)
export const bench = createBenchmark(
  function (name, fn: BenchFunction = noop, options: BenchOptions = {}) {
    getCurrentSuite().benchmark.fn.call(this, name, fn, options)
  },
)

// alias
export const describe = suite
export const it = test

const workerState = getWorkerState()

export const defaultSuite = workerState.config.sequence.shuffle
  ? suite.shuffle('')
  : suite('')

export function clearCollectorContext() {
  collectorContext.tasks.length = 0
  defaultSuite.clear()
  collectorContext.currentSuite = defaultSuite
}

export function getCurrentSuite<ExtraContext = {}>() {
  return (collectorContext.currentSuite || defaultSuite) as SuiteCollector<ExtraContext>
}

export function createSuiteHooks() {
  return {
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  }
}

// implementations
function createSuiteCollector(name: string, factory: SuiteFactory = () => { }, mode: RunMode, concurrent?: boolean, shuffle?: boolean, suiteOptions?: number | TestOptions) {
  const tasks: (Benchmark | Test | Suite | SuiteCollector)[] = []
  const factoryQueue: (Test | Suite | SuiteCollector)[] = []

  let suite: Suite

  initSuite()

  const test = createTest(function (name: string, fn = noop, options = suiteOptions) {
    if (!isRunningInTest())
      throw new Error('`test()` and `it()` is only available in test mode.')

    const mode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'

    if (typeof options === 'number')
      options = { timeout: options }

    const test: Test = {
      id: '',
      type: 'test',
      name,
      mode,
      suite: undefined!,
      fails: this.fails,
      retry: options?.retry,
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
      options?.timeout,
    ))

    tasks.push(test)
  })

  const benchmark = createBenchmark(function (name: string, fn = noop, options: BenchOptions = {}) {
    const mode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'

    if (!isRunningInBenchmark())
      throw new Error('`bench()` is only available in benchmark mode. Run with `vitest bench` instead.')

    const benchmark: Benchmark = {
      type: 'benchmark',
      id: '',
      name,
      mode,
      options,
      suite: undefined!,
    }

    setFn(benchmark, fn)
    tasks.push(benchmark)
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
  function suiteFn(this: Record<string, boolean | undefined>, name: string, factory?: SuiteFactory, options?: number | TestOptions) {
    const mode: RunMode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'
    return createSuiteCollector(name, factory, mode, this.concurrent, this.shuffle, options)
  }

  suiteFn.each = function<T>(this: { withContext: () => SuiteAPI }, cases: ReadonlyArray<T>) {
    const suite = this.withContext()
    return (name: string, fn: (...args: T[]) => void, options?: number | TestOptions) => {
      const arrayOnlyCases = cases.every(Array.isArray)
      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]
        arrayOnlyCases
          ? suite(formatTitle(name, items, idx), () => fn(...items), options)
          : suite(formatTitle(name, items, idx), () => fn(i), options)
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
    options?: number | TestOptions
  ) => void
)) {
  const testFn = fn as any

  testFn.each = function<T>(this: { withContext: () => TestAPI }, cases: ReadonlyArray<T>) {
    const test = this.withContext()

    return (name: string, fn: (...args: T[]) => void, options?: number | TestOptions) => {
      const arrayOnlyCases = cases.every(Array.isArray)
      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]
        arrayOnlyCases
          ? test(formatTitle(name, items, idx), () => fn(...items), options)
          : test(formatTitle(name, items, idx), () => fn(i), options)
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

function createBenchmark(fn: (
  (
    this: Record<'skip' | 'only' | 'todo', boolean | undefined>,
    name: string,
    fn?: BenchFunction,
    options?: BenchOptions
  ) => void
)) {
  const benchmark = createChainable(
    ['skip', 'only', 'todo'],
    fn,
  ) as BenchmarkAPI

  benchmark.skipIf = (condition: any) => (condition ? benchmark.skip : benchmark) as BenchmarkAPI
  benchmark.runIf = (condition: any) => (condition ? benchmark : benchmark.skip) as BenchmarkAPI

  return benchmark as BenchmarkAPI
}

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
