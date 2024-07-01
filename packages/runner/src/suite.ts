import {
  format,
  isNegativeNaN,
  isObject,
  objDisplay,
  objectAttr,
  toArray,
} from '@vitest/utils'
import { parseSingleStack } from '@vitest/utils/source-map'
import type {
  Custom,
  CustomAPI,
  File,
  Fixtures,
  RunMode,
  Suite,
  SuiteAPI,
  SuiteCollector,
  SuiteFactory,
  SuiteHooks,
  Task,
  TaskCustomOptions,
  Test,
  TestAPI,
  TestFunction,
  TestOptions,
} from './types'
import type { VitestRunner } from './types/runner'
import { createChainable } from './utils/chain'
import {
  collectTask,
  collectorContext,
  createTestContext,
  runWithSuite,
  withTimeout,
} from './context'
import { getHooks, setFixture, setFn, setHooks } from './map'
import type { FixtureItem } from './fixture'
import { mergeContextFixtures, withFixtures } from './fixture'
import { getCurrentTest } from './test-state'

// apis
export const suite = createSuite()
export const test = createTest(function (
  name: string | Function,
  optionsOrFn?: TestOptions | TestFunction,
  optionsOrTest?: number | TestOptions | TestFunction,
) {
  if (getCurrentTest()) {
    throw new Error(
      'Calling the test function inside another test function is not allowed. Please put it inside "describe" or "suite" so it can be properly collected.',
    )
  }

  getCurrentSuite().test.fn.call(
    this,
    formatName(name),
    optionsOrFn as TestOptions,
    optionsOrTest as TestFunction,
  )
})

// alias
export const describe = suite
export const it = test

let runner: VitestRunner
let defaultSuite: SuiteCollector
let currentTestFilepath: string

export function getDefaultSuite() {
  return defaultSuite
}

export function getTestFilepath() {
  return currentTestFilepath
}

export function getRunner() {
  return runner
}

function createDefaultSuite(runner: VitestRunner) {
  const config = runner.config.sequence
  const api = config.shuffle ? suite.shuffle : suite
  return api('', { concurrent: config.concurrent }, () => {})
}

export function clearCollectorContext(
  filepath: string,
  currentRunner: VitestRunner,
) {
  if (!defaultSuite) {
    defaultSuite = createDefaultSuite(currentRunner)
  }
  runner = currentRunner
  currentTestFilepath = filepath
  collectorContext.tasks.length = 0
  defaultSuite.clear()
  collectorContext.currentSuite = defaultSuite
}

export function getCurrentSuite<ExtraContext = {}>() {
  return (collectorContext.currentSuite
    || defaultSuite) as SuiteCollector<ExtraContext>
}

export function createSuiteHooks() {
  return {
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
  }
}

function parseArguments<T extends (...args: any[]) => any>(
  optionsOrFn: T | object | undefined,
  optionsOrTest: object | T | number | undefined,
) {
  let options: TestOptions = {}
  let fn: T = (() => {}) as T

  // it('', () => {}, { retry: 2 })
  if (typeof optionsOrTest === 'object') {
    // it('', { retry: 2 }, { retry: 3 })
    if (typeof optionsOrFn === 'object') {
      throw new TypeError(
        'Cannot use two objects as arguments. Please provide options and a function callback in that order.',
      )
    }
    // TODO: more info, add a name
    // console.warn('The third argument is deprecated. Please use the second argument for options.')
    options = optionsOrTest
  }
  // it('', () => {}, 1000)
  else if (typeof optionsOrTest === 'number') {
    options = { timeout: optionsOrTest }
  }
  // it('', { retry: 2 }, () => {})
  else if (typeof optionsOrFn === 'object') {
    options = optionsOrFn
  }

  if (typeof optionsOrFn === 'function') {
    if (typeof optionsOrTest === 'function') {
      throw new TypeError(
        'Cannot use two functions as arguments. Please use the second argument for options.',
      )
    }
    fn = optionsOrFn as T
  }
  else if (typeof optionsOrTest === 'function') {
    fn = optionsOrTest as T
  }

  return {
    options,
    handler: fn,
  }
}

// implementations
function createSuiteCollector(
  name: string,
  factory: SuiteFactory = () => {},
  mode: RunMode,
  shuffle?: boolean,
  each?: boolean,
  suiteOptions?: TestOptions,
) {
  const tasks: (Test | Custom | Suite | SuiteCollector)[] = []
  const factoryQueue: (Test | Suite | SuiteCollector)[] = []

  let suite: Suite

  initSuite(true)

  const task = function (name = '', options: TaskCustomOptions = {}) {
    const task: Custom = {
      id: '',
      name,
      suite: undefined!,
      each: options.each,
      fails: options.fails,
      context: undefined!,
      type: 'custom',
      file: undefined!,
      retry: options.retry ?? runner.config.retry,
      repeats: options.repeats,
      mode: options.only
        ? 'only'
        : options.skip
          ? 'skip'
          : options.todo
            ? 'todo'
            : 'run',
      meta: options.meta ?? Object.create(null),
    }
    const handler = options.handler
    if (
      options.concurrent
      || (!options.sequential && runner.config.sequence.concurrent)
    ) {
      task.concurrent = true
    }
    if (shuffle) {
      task.shuffle = true
    }

    const context = createTestContext(task, runner)
    // create test context
    Object.defineProperty(task, 'context', {
      value: context,
      enumerable: false,
    })
    setFixture(context, options.fixtures)

    if (handler) {
      setFn(
        task,
        withTimeout(
          withFixtures(handler, context),
          options?.timeout ?? runner.config.testTimeout,
        ),
      )
    }

    if (runner.config.includeTaskLocation) {
      const limit = Error.stackTraceLimit
      // custom can be called from any place, let's assume the limit is 15 stacks
      Error.stackTraceLimit = 15
      const error = new Error('stacktrace').stack!
      Error.stackTraceLimit = limit
      const stack = findTestFileStackTrace(error, task.each ?? false)
      if (stack) {
        task.location = stack
      }
    }

    tasks.push(task)
    return task
  }

  const test = createTest(function (
    name: string | Function,
    optionsOrFn?: TestOptions | TestFunction,
    optionsOrTest?: number | TestOptions | TestFunction,
  ) {
    let { options, handler } = parseArguments(optionsOrFn, optionsOrTest)

    // inherit repeats, retry, timeout from suite
    if (typeof suiteOptions === 'object') {
      options = Object.assign({}, suiteOptions, options)
    }

    // inherit concurrent / sequential from suite
    options.concurrent
      = this.concurrent || (!this.sequential && options?.concurrent)
    options.sequential
      = this.sequential || (!this.concurrent && options?.sequential)

    const test = task(formatName(name), {
      ...this,
      ...options,
      handler,
    }) as unknown as Test

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
    getHooks(suite)[name].push(...(fn as any))
  }

  function initSuite(includeLocation: boolean) {
    if (typeof suiteOptions === 'number') {
      suiteOptions = { timeout: suiteOptions }
    }

    suite = {
      id: '',
      type: 'suite',
      name,
      mode,
      each,
      file: undefined!,
      shuffle,
      tasks: [],
      meta: Object.create(null),
      concurrent: suiteOptions?.concurrent,
    }

    if (runner && includeLocation && runner.config.includeTaskLocation) {
      const limit = Error.stackTraceLimit
      Error.stackTraceLimit = 15
      const error = new Error('stacktrace').stack!
      Error.stackTraceLimit = limit
      const stack = findTestFileStackTrace(error, suite.each ?? false)
      if (stack) {
        suite.location = stack
      }
    }

    setHooks(suite, createSuiteHooks())
  }

  function clear() {
    tasks.length = 0
    factoryQueue.length = 0
    initSuite(false)
  }

  async function collect(file: File) {
    if (!file) {
      throw new TypeError('File is required to collect tasks.')
    }

    factoryQueue.length = 0
    if (factory) {
      await runWithSuite(collector, () => factory(test))
    }

    const allChildren: Task[] = []

    for (const i of [...factoryQueue, ...tasks]) {
      allChildren.push(i.type === 'collector' ? await i.collect(file) : i)
    }

    suite.file = file
    suite.tasks = allChildren

    allChildren.forEach((task) => {
      task.suite = suite
      task.file = file
    })

    return suite
  }

  collectTask(collector)
  return collector
}

function createSuite() {
  function suiteFn(
    this: Record<string, boolean | undefined>,
    name: string | Function,
    factoryOrOptions?: SuiteFactory | TestOptions,
    optionsOrFactory: number | TestOptions | SuiteFactory = {},
  ) {
    const mode: RunMode = this.only
      ? 'only'
      : this.skip
        ? 'skip'
        : this.todo
          ? 'todo'
          : 'run'
    const currentSuite = getCurrentSuite()

    let { options, handler: factory } = parseArguments(
      factoryOrOptions,
      optionsOrFactory,
    )

    // inherit options from current suite
    if (currentSuite?.options) {
      options = { ...currentSuite.options, ...options }
    }

    // inherit concurrent / sequential from suite
    const isConcurrent
      = options.concurrent || (this.concurrent && !this.sequential)
    const isSequential
      = options.sequential || (this.sequential && !this.concurrent)
    options.concurrent = isConcurrent && !isSequential
    options.sequential = isSequential && !isConcurrent

    return createSuiteCollector(
      formatName(name),
      factory,
      mode,
      this.shuffle,
      this.each,
      options,
    )
  }

  suiteFn.each = function <T>(
    this: {
      withContext: () => SuiteAPI
      setContext: (key: string, value: boolean | undefined) => SuiteAPI
    },
    cases: ReadonlyArray<T>,
    ...args: any[]
  ) {
    const suite = this.withContext()
    this.setContext('each', true)

    if (Array.isArray(cases) && args.length) {
      cases = formatTemplateString(cases, args)
    }

    return (
      name: string | Function,
      optionsOrFn: ((...args: T[]) => void) | TestOptions,
      fnOrOptions?: ((...args: T[]) => void) | number | TestOptions,
    ) => {
      const _name = formatName(name)
      const arrayOnlyCases = cases.every(Array.isArray)

      const { options, handler } = parseArguments(optionsOrFn, fnOrOptions)

      const fnFirst = typeof optionsOrFn === 'function'

      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]
        if (fnFirst) {
          arrayOnlyCases
            ? suite(
              formatTitle(_name, items, idx),
              () => handler(...items),
              options,
            )
            : suite(formatTitle(_name, items, idx), () => handler(i), options)
        }
        else {
          arrayOnlyCases
            ? suite(formatTitle(_name, items, idx), options, () =>
              handler(...items))
            : suite(formatTitle(_name, items, idx), options, () => handler(i))
        }
      })

      this.setContext('each', undefined)
    }
  }

  suiteFn.skipIf = (condition: any) =>
    (condition ? suite.skip : suite) as SuiteAPI
  suiteFn.runIf = (condition: any) =>
    (condition ? suite : suite.skip) as SuiteAPI

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

  taskFn.each = function <T>(
    this: {
      withContext: () => SuiteAPI
      setContext: (key: string, value: boolean | undefined) => SuiteAPI
    },
    cases: ReadonlyArray<T>,
    ...args: any[]
  ) {
    const test = this.withContext()
    this.setContext('each', true)

    if (Array.isArray(cases) && args.length) {
      cases = formatTemplateString(cases, args)
    }

    return (
      name: string | Function,
      optionsOrFn: ((...args: T[]) => void) | TestOptions,
      fnOrOptions?: ((...args: T[]) => void) | number | TestOptions,
    ) => {
      const _name = formatName(name)
      const arrayOnlyCases = cases.every(Array.isArray)

      const { options, handler } = parseArguments(optionsOrFn, fnOrOptions)

      const fnFirst = typeof optionsOrFn === 'function'

      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]

        if (fnFirst) {
          arrayOnlyCases
            ? test(
              formatTitle(_name, items, idx),
              () => handler(...items),
              options,
            )
            : test(formatTitle(_name, items, idx), () => handler(i), options)
        }
        else {
          arrayOnlyCases
            ? test(formatTitle(_name, items, idx), options, () =>
              handler(...items))
            : test(formatTitle(_name, items, idx), options, () => handler(i))
        }
      })

      this.setContext('each', undefined)
    }
  }

  taskFn.for = function <T>(
    this: {
      withContext: () => SuiteAPI
      setContext: (key: string, value: boolean | undefined) => SuiteAPI
    },
    cases: ReadonlyArray<T>,
    ...args: any[]
  ) {
    const test = this.withContext()

    if (Array.isArray(cases) && args.length) {
      cases = formatTemplateString(cases, args)
    }

    return (
      name: string | Function,
      optionsOrFn: ((...args: T[]) => void) | TestOptions,
      fnOrOptions?: ((...args: T[]) => void) | number | TestOptions,
    ) => {
      const _name = formatName(name)
      const { options, handler } = parseArguments(optionsOrFn, fnOrOptions)
      cases.forEach((item, idx) => {
        // monkey-patch handler to allow parsing fixture
        const handlerWrapper = (ctx: any) => handler(item, ctx);
        (handlerWrapper as any).__VITEST_FIXTURE_INDEX__ = 1;
        (handlerWrapper as any).toString = () => handler.toString()
        test(formatTitle(_name, toArray(item), idx), options, handlerWrapper)
      })
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

    return createTest(function fn(
      name: string | Function,
      optionsOrFn?: TestOptions | TestFunction,
      optionsOrTest?: number | TestOptions | TestFunction,
    ) {
      getCurrentSuite().test.fn.call(
        this,
        formatName(name),
        optionsOrFn as TestOptions,
        optionsOrTest as TestFunction,
      )
    }, _context)
  }

  const _test = createChainable(
    ['concurrent', 'sequential', 'skip', 'only', 'todo', 'fails'],
    taskFn,
  ) as CustomAPI

  if (context) {
    (_test as any).mergeContext(context)
  }

  return _test
}

function createTest(
  fn: (
    this: Record<
      'concurrent' | 'sequential' | 'skip' | 'only' | 'todo' | 'fails' | 'each',
      boolean | undefined
    > & { fixtures?: FixtureItem[] },
    title: string,
    optionsOrFn?: TestOptions | TestFunction,
    optionsOrTest?: number | TestOptions | TestFunction
  ) => void,
  context?: Record<string, any>,
) {
  return createTaskCollector(fn, context) as TestAPI
}

function formatName(name: string | Function) {
  return typeof name === 'string'
    ? name
    : name instanceof Function
      ? name.name || '<anonymous>'
      : String(name)
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

  if (template.includes('%f')) {
    const placeholders = template.match(/%f/g) || []
    placeholders.forEach((_, i) => {
      if (isNegativeNaN(items[i]) || Object.is(items[i], -0)) {
        // Replace the i-th occurrence of '%f' with '-%f'
        let occurrence = 0
        template = template.replace(/%f/g, (match) => {
          occurrence++
          return occurrence === i + 1 ? '-%f' : match
        })
      }
    })
  }

  let formatted = format(template, ...items.slice(0, count))
  if (isObject(items[0])) {
    formatted = formatted.replace(
      /\$([$\w.]+)/g,
      // https://github.com/chaijs/chai/pull/1490
      (_, key) =>
        objDisplay(objectAttr(items[0], key), {
          truncate: runner?.config?.chaiConfig?.truncateThreshold,
        }) as unknown as string,
    )
  }
  return formatted
}

function formatTemplateString(cases: any[], args: any[]): any[] {
  const header = cases
    .join('')
    .trim()
    .replace(/ /g, '')
    .split('\n')
    .map(i => i.split('|'))[0]
  const res: any[] = []
  for (let i = 0; i < Math.floor(args.length / header.length); i++) {
    const oneCase: Record<string, any> = {}
    for (let j = 0; j < header.length; j++) {
      oneCase[header[j]] = args[i * header.length + j] as any
    }
    res.push(oneCase)
  }
  return res
}

function findTestFileStackTrace(error: string, each: boolean) {
  // first line is the error message
  const lines = error.split('\n').slice(1)
  for (const line of lines) {
    const stack = parseSingleStack(line)
    if (stack && stack.file === getTestFilepath()) {
      return {
        line: stack.line,
        /**
         * test.each([1, 2])('name')
         *                 ^ leads here, but should
         *                  ^ lead here
         * in source maps it's the same boundary, so it just points to the start of it
         */
        column: each ? stack.column + 1 : stack.column,
      }
    }
  }
}
