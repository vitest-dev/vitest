import { format, isObject, noop, objDisplay, objectAttr } from '@vitest/utils'
import type { Custom, CustomAPI, File, Fixtures, RunMode, Suite, SuiteAPI, SuiteCollector, SuiteFactory, SuiteHooks, Task, TaskCustomOptions, Test, TestAPI, TestFunction, TestOptions } from './types'
import type { VitestRunner } from './types/runner'
import { createChainable } from './utils/chain'
import { collectTask, collectorContext, createTestContext, runWithSuite, withTimeout } from './context'
import { getHooks, setFixture, setFn, setHooks } from './map'
import type { FixtureItem } from './fixture'
import { mergeContextFixtures, withFixtures } from './fixture'
import { getCurrentTest } from './test-state'

// apis
export const suite = createSuite()
export const test = createTest(
  function (name: string | Function, fn?: TestFunction, options?: number | TestOptions) {
    if (getCurrentTest())
      throw new Error('Calling the test function inside another test function is not allowed. Please put it inside "describe" or "suite" so it can be properly collected.')

    getCurrentSuite().test.fn.call(this, formatName(name), fn, options)
  },
)

// alias
export const describe = suite
export const it = test

let runner: VitestRunner
let defaultSuite: SuiteCollector

export function getDefaultSuite() {
  return defaultSuite
}

export function getRunner() {
  return runner
}

export function clearCollectorContext(currentRunner: VitestRunner) {
  if (!defaultSuite)
    defaultSuite = currentRunner.config.sequence.shuffle ? suite.shuffle('') : currentRunner.config.sequence.concurrent ? suite.concurrent('') : suite('')
  runner = currentRunner
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
function createSuiteCollector(name: string, factory: SuiteFactory = () => { }, mode: RunMode, concurrent?: boolean, sequential?: boolean, shuffle?: boolean, each?: boolean, suiteOptions?: TestOptions) {
  const tasks: (Test | Custom | Suite | SuiteCollector)[] = []
  const factoryQueue: (Test | Suite | SuiteCollector)[] = []

  let suite: Suite

  initSuite()

  const task = function (name = '', options: TaskCustomOptions = {}) {
    const task: Custom = {
      id: '',
      name,
      suite: undefined!,
      each: options.each,
      fails: options.fails,
      context: undefined!,
      type: 'custom',
      retry: options.retry ?? runner.config.retry,
      repeats: options.repeats,
      mode: options.only ? 'only' : options.skip ? 'skip' : options.todo ? 'todo' : 'run',
      meta: options.meta ?? Object.create(null),
    }
    const handler = options.handler
    if (options.concurrent || (!options.sequential && runner.config.sequence.concurrent))
      task.concurrent = true
    if (shuffle)
      task.shuffle = true

    const context = createTestContext(task, runner)
    // create test context
    Object.defineProperty(task, 'context', {
      value: context,
      enumerable: false,
    })
    setFixture(context, options.fixtures)

    if (handler) {
      setFn(task, withTimeout(
        withFixtures(handler, context),
        options?.timeout ?? runner.config.testTimeout,
      ))
    }

    tasks.push(task)
    return task
  }

  const test = createTest(function (name: string | Function, fn = noop, options = {}) {
    if (typeof options === 'number')
      options = { timeout: options }

    // inherit repeats, retry, timeout from suite
    if (typeof suiteOptions === 'object')
      options = Object.assign({}, suiteOptions, options)

    // inherit concurrent / sequential from suite
    options.concurrent = this.concurrent || (!this.sequential && options?.concurrent)
    options.sequential = this.sequential || (!this.concurrent && options?.sequential)

    const test = task(
      formatName(name),
      { ...this, ...options, handler: fn as any },
    ) as unknown as Test

    test.type = 'test'
  })

  const collector: SuiteCollector = {
    type: 'collector',
    name,
    mode,
    options: suiteOptions,
    test,
    tasks,
    collect,
    task,
    clear,
    on: addHook,
  }

  function addHook<T extends keyof SuiteHooks>(name: T, ...fn: SuiteHooks[T]) {
    getHooks(suite)[name].push(...fn as any)
  }

  function initSuite() {
    if (typeof suiteOptions === 'number')
      suiteOptions = { timeout: suiteOptions }

    suite = {
      id: '',
      type: 'suite',
      name,
      mode,
      each,
      shuffle,
      tasks: [],
      meta: Object.create(null),
      projectName: '',
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
  function suiteFn(this: Record<string, boolean | undefined>, name: string | Function, factory?: SuiteFactory, options: number | TestOptions = {}) {
    const mode: RunMode = this.only ? 'only' : this.skip ? 'skip' : this.todo ? 'todo' : 'run'
    const currentSuite = getCurrentSuite()

    if (typeof options === 'number')
      options = { timeout: options }

    // inherit options from current suite
    if (currentSuite?.options)
      options = { ...currentSuite.options, ...options }

    // inherit concurrent / sequential from current suite
    options.concurrent = this.concurrent || (!this.sequential && options?.concurrent)
    options.sequential = this.sequential || (!this.concurrent && options?.sequential)

    return createSuiteCollector(formatName(name), factory, mode, this.concurrent, this.sequential, this.shuffle, this.each, options)
  }

  suiteFn.each = function<T>(this: { withContext: () => SuiteAPI; setContext: (key: string, value: boolean | undefined) => SuiteAPI }, cases: ReadonlyArray<T>, ...args: any[]) {
    const suite = this.withContext()
    this.setContext('each', true)

    if (Array.isArray(cases) && args.length)
      cases = formatTemplateString(cases, args)

    return (name: string | Function, fn: (...args: T[]) => void, options?: number | TestOptions) => {
      const _name = formatName(name)
      const arrayOnlyCases = cases.every(Array.isArray)
      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]
        arrayOnlyCases
          ? suite(formatTitle(_name, items, idx), () => fn(...items), options)
          : suite(formatTitle(_name, items, idx), () => fn(i), options)
      })

      this.setContext('each', undefined)
    }
  }

  suiteFn.skipIf = (condition: any) => (condition ? suite.skip : suite) as SuiteAPI
  suiteFn.runIf = (condition: any) => (condition ? suite : suite.skip) as SuiteAPI

  return createChainable(
    ['concurrent', 'sequential', 'shuffle', 'skip', 'only', 'todo'],
    suiteFn,
  ) as unknown as SuiteAPI
}

export function createTaskCollector(
  fn: (...args: any[]) => any,
  context?: Record<string, unknown>,
) {
  const taskFn = fn as any

  taskFn.each = function<T>(this: { withContext: () => SuiteAPI; setContext: (key: string, value: boolean | undefined) => SuiteAPI }, cases: ReadonlyArray<T>, ...args: any[]) {
    const test = this.withContext()
    this.setContext('each', true)

    if (Array.isArray(cases) && args.length)
      cases = formatTemplateString(cases, args)

    return (name: string | Function, fn: (...args: T[]) => void, options?: number | TestOptions) => {
      const _name = formatName(name)
      const arrayOnlyCases = cases.every(Array.isArray)
      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]

        arrayOnlyCases
          ? test(formatTitle(_name, items, idx), () => fn(...items), options)
          : test(formatTitle(_name, items, idx), () => fn(i), options)
      })

      this.setContext('each', undefined)
    }
  }

  taskFn.skipIf = function (this: TestAPI, condition: any) {
    return condition ? this.skip : this
  }
  taskFn.runIf = function (this: TestAPI, condition: any) {
    return condition ? this : this.skip
  }

  taskFn.extend = function (fixtures: Fixtures<Record<string, any>>) {
    const _context = mergeContextFixtures(fixtures, context)

    return createTest(function fn(name: string | Function, fn?: TestFunction, options?: number | TestOptions) {
      getCurrentSuite().test.fn.call(this, formatName(name), fn, options)
    }, _context)
  }

  const _test = createChainable(
    ['concurrent', 'sequential', 'skip', 'only', 'todo', 'fails'],
    taskFn,
  ) as CustomAPI

  if (context)
    (_test as any).mergeContext(context)

  return _test
}

function createTest(fn: (
  (
    this: Record<'concurrent' | 'sequential' | 'skip' | 'only' | 'todo' | 'fails' | 'each', boolean | undefined> & { fixtures?: FixtureItem[] },
    title: string,
    fn?: TestFunction,
    options?: number | TestOptions
  ) => void
), context?: Record<string, any>) {
  return createTaskCollector(fn, context) as TestAPI
}

function formatName(name: string | Function) {
  return typeof name === 'string' ? name : name instanceof Function ? (name.name || '<anonymous>') : String(name)
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
  let formatted = format(template, ...items.slice(0, count))
  if (isObject(items[0])) {
    formatted = formatted.replace(
      /\$([$\w_.]+)/g,
      // https://github.com/chaijs/chai/pull/1490
      (_, key) => objDisplay(objectAttr(items[0], key), { truncate: runner?.config?.chaiConfig?.truncateThreshold }) as unknown as string,
    )
  }
  return formatted
}

function formatTemplateString(cases: any[], args: any[]): any[] {
  const header = cases.join('').trim().replace(/ /g, '').split('\n').map(i => i.split('|'))[0]
  const res: any[] = []
  for (let i = 0; i < Math.floor((args.length) / header.length); i++) {
    const oneCase: Record<string, any> = {}
    for (let j = 0; j < header.length; j++)
      oneCase[header[j]] = args[i * header.length + j] as any
    res.push(oneCase)
  }
  return res
}
