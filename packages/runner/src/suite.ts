import type { FixtureItem } from './fixture'
import type { VitestRunner } from './types/runner'
import type {
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
  TaskPopulated,
  Test,
  TestAPI,
  TestFunction,
  TestOptions,
} from './types/tasks'
import {
  format,
  isNegativeNaN,
  isObject,
  objDisplay,
  objectAttr,
  toArray,
} from '@vitest/utils'
import { parseSingleStack } from '@vitest/utils/source-map'
import {
  abortIfTimeout,
  collectorContext,
  collectTask,
  createTestContext,
  runWithSuite,
  withTimeout,
} from './context'
import { mergeContextFixtures, mergeScopedFixtures, withFixtures } from './fixture'
import { getHooks, setFn, setHooks, setTestFixture } from './map'
import { getCurrentTest } from './test-state'
import { createChainable } from './utils/chain'

/**
 * Creates a suite of tests, allowing for grouping and hierarchical organization of tests.
 * Suites can contain both tests and other suites, enabling complex test structures.
 *
 * @param {string} name - The name of the suite, used for identification and reporting.
 * @param {Function} fn - A function that defines the tests and suites within this suite.
 * @example
 * ```ts
 * // Define a suite with two tests
 * suite('Math operations', () => {
 *   test('should add two numbers', () => {
 *     expect(add(1, 2)).toBe(3);
 *   });
 *
 *   test('should subtract two numbers', () => {
 *     expect(subtract(5, 2)).toBe(3);
 *   });
 * });
 * ```
 * @example
 * ```ts
 * // Define nested suites
 * suite('String operations', () => {
 *   suite('Trimming', () => {
 *     test('should trim whitespace from start and end', () => {
 *       expect('  hello  '.trim()).toBe('hello');
 *     });
 *   });
 *
 *   suite('Concatenation', () => {
 *     test('should concatenate two strings', () => {
 *       expect('hello' + ' ' + 'world').toBe('hello world');
 *     });
 *   });
 * });
 * ```
 */
export const suite: SuiteAPI = createSuite()
/**
 * Defines a test case with a given name and test function. The test function can optionally be configured with test options.
 *
 * @param {string | Function} name - The name of the test or a function that will be used as a test name.
 * @param {TestOptions | TestFunction} [optionsOrFn] - Optional. The test options or the test function if no explicit name is provided.
 * @param {number | TestOptions | TestFunction} [optionsOrTest] - Optional. The test function or options, depending on the previous parameters.
 * @throws {Error} If called inside another test function.
 * @example
 * ```ts
 * // Define a simple test
 * test('should add two numbers', () => {
 *   expect(add(1, 2)).toBe(3);
 * });
 * ```
 * @example
 * ```ts
 * // Define a test with options
 * test('should subtract two numbers', { retry: 3 }, () => {
 *   expect(subtract(5, 2)).toBe(3);
 * });
 * ```
 */
export const test: TestAPI = createTest(function (
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

/**
 * Creates a suite of tests, allowing for grouping and hierarchical organization of tests.
 * Suites can contain both tests and other suites, enabling complex test structures.
 *
 * @param {string} name - The name of the suite, used for identification and reporting.
 * @param {Function} fn - A function that defines the tests and suites within this suite.
 * @example
 * ```ts
 * // Define a suite with two tests
 * describe('Math operations', () => {
 *   test('should add two numbers', () => {
 *     expect(add(1, 2)).toBe(3);
 *   });
 *
 *   test('should subtract two numbers', () => {
 *     expect(subtract(5, 2)).toBe(3);
 *   });
 * });
 * ```
 * @example
 * ```ts
 * // Define nested suites
 * describe('String operations', () => {
 *   describe('Trimming', () => {
 *     test('should trim whitespace from start and end', () => {
 *       expect('  hello  '.trim()).toBe('hello');
 *     });
 *   });
 *
 *   describe('Concatenation', () => {
 *     test('should concatenate two strings', () => {
 *       expect('hello' + ' ' + 'world').toBe('hello world');
 *     });
 *   });
 * });
 * ```
 */
export const describe: SuiteAPI = suite
/**
 * Defines a test case with a given name and test function. The test function can optionally be configured with test options.
 *
 * @param {string | Function} name - The name of the test or a function that will be used as a test name.
 * @param {TestOptions | TestFunction} [optionsOrFn] - Optional. The test options or the test function if no explicit name is provided.
 * @param {number | TestOptions | TestFunction} [optionsOrTest] - Optional. The test function or options, depending on the previous parameters.
 * @throws {Error} If called inside another test function.
 * @example
 * ```ts
 * // Define a simple test
 * it('adds two numbers', () => {
 *   expect(add(1, 2)).toBe(3);
 * });
 * ```
 * @example
 * ```ts
 * // Define a test with options
 * it('subtracts two numbers', { retry: 3 }, () => {
 *   expect(subtract(5, 2)).toBe(3);
 * });
 * ```
 */
export const it: TestAPI = test

let runner: VitestRunner
let defaultSuite: SuiteCollector
let currentTestFilepath: string

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`Vitest failed to find ${message}. This is a bug in Vitest. Please, open an issue with reproduction.`)
  }
}

export function getDefaultSuite(): SuiteCollector<object> {
  assert(defaultSuite, 'the default suite')
  return defaultSuite
}

export function getTestFilepath(): string {
  return currentTestFilepath
}

export function getRunner(): VitestRunner {
  assert(runner, 'the runner')
  return runner
}

function createDefaultSuite(runner: VitestRunner) {
  const config = runner.config.sequence
  const collector = suite('', { concurrent: config.concurrent }, () => {})
  // no parent suite for top-level tests
  delete collector.suite
  return collector
}

export function clearCollectorContext(
  filepath: string,
  currentRunner: VitestRunner,
): void {
  if (!defaultSuite) {
    defaultSuite = createDefaultSuite(currentRunner)
  }
  runner = currentRunner
  currentTestFilepath = filepath
  collectorContext.tasks.length = 0
  defaultSuite.clear()
  collectorContext.currentSuite = defaultSuite
}

export function getCurrentSuite<ExtraContext = object>(): SuiteCollector<ExtraContext> {
  const currentSuite = (collectorContext.currentSuite
    || defaultSuite) as SuiteCollector<ExtraContext>
  assert(currentSuite, 'the current suite')
  return currentSuite
}

export function createSuiteHooks(): SuiteHooks {
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
    console.warn(
      'Using an object as a third argument is deprecated. Vitest 4 will throw an error if the third argument is not a timeout number. Please use the second argument for options. See more at https://vitest.dev/guide/migration',
    )
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
  each?: boolean,
  suiteOptions?: TestOptions,
  parentCollectorFixtures?: FixtureItem[],
) {
  const tasks: (Test | Suite | SuiteCollector)[] = []

  let suite!: Suite

  initSuite(true)

  const task = function (name = '', options: TaskCustomOptions = {}) {
    const timeout = options?.timeout ?? runner.config.testTimeout
    const task: Test = {
      id: '',
      name,
      suite: collectorContext.currentSuite?.suite,
      each: options.each,
      fails: options.fails,
      context: undefined!,
      type: 'test',
      file: undefined!,
      timeout,
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
      annotations: [],
    }
    const handler = options.handler
    if (
      options.concurrent
      || (!options.sequential && runner.config.sequence.concurrent)
    ) {
      task.concurrent = true
    }
    task.shuffle = suiteOptions?.shuffle

    const context = createTestContext(task, runner)
    // create test context
    Object.defineProperty(task, 'context', {
      value: context,
      enumerable: false,
    })
    setTestFixture(context, options.fixtures)

    // custom can be called from any place, let's assume the limit is 15 stacks
    const limit = Error.stackTraceLimit
    Error.stackTraceLimit = 15
    const stackTraceError = new Error('STACK_TRACE_ERROR')
    Error.stackTraceLimit = limit

    if (handler) {
      setFn(
        task,
        withTimeout(
          withAwaitAsyncAssertions(withFixtures(runner, handler, context), task),
          timeout,
          false,
          stackTraceError,
          (_, error) => abortIfTimeout([context], error),
        ),
      )
    }

    if (runner.config.includeTaskLocation) {
      const error = stackTraceError.stack!
      const stack = findTestFileStackTrace(error)
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

  let collectorFixtures = parentCollectorFixtures

  const collector: SuiteCollector = {
    type: 'collector',
    name,
    mode,
    suite,
    options: suiteOptions,
    test,
    tasks,
    collect,
    task,
    clear,
    on: addHook,
    fixtures() {
      return collectorFixtures
    },
    scoped(fixtures) {
      const parsed = mergeContextFixtures(
        fixtures,
        { fixtures: collectorFixtures },
        runner,
      )
      if (parsed.fixtures) {
        collectorFixtures = parsed.fixtures
      }
    },
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
      suite: collectorContext.currentSuite?.suite,
      mode,
      each,
      file: undefined!,
      shuffle: suiteOptions?.shuffle,
      tasks: [],
      meta: Object.create(null),
      concurrent: suiteOptions?.concurrent,
    }

    if (runner && includeLocation && runner.config.includeTaskLocation) {
      const limit = Error.stackTraceLimit
      Error.stackTraceLimit = 15
      const error = new Error('stacktrace').stack!
      Error.stackTraceLimit = limit
      const stack = findTestFileStackTrace(error)
      if (stack) {
        suite.location = stack
      }
    }

    setHooks(suite, createSuiteHooks())
  }

  function clear() {
    tasks.length = 0
    initSuite(false)
  }

  async function collect(file: File) {
    if (!file) {
      throw new TypeError('File is required to collect tasks.')
    }

    if (factory) {
      await runWithSuite(collector, () => factory(test))
    }

    const allChildren: Task[] = []

    for (const i of tasks) {
      allChildren.push(i.type === 'collector' ? await i.collect(file) : i)
    }

    suite.file = file
    suite.tasks = allChildren

    allChildren.forEach((task) => {
      task.file = file
    })

    return suite
  }

  collectTask(collector)
  return collector
}

function withAwaitAsyncAssertions<T extends (...args: any[]) => any>(fn: T, task: TaskPopulated): T {
  return (async (...args: any[]) => {
    const fnResult = await fn(...args)
    // some async expect will be added to this array, in case user forget to await them
    if (task.promises) {
      const result = await Promise.allSettled(task.promises)
      const errors = result
        .map(r => (r.status === 'rejected' ? r.reason : undefined))
        .filter(Boolean)
      if (errors.length) {
        throw errors
      }
    }
    return fnResult
  }) as T
}

function createSuite() {
  function suiteFn(
    this: Record<string, boolean | undefined>,
    name: string | Function,
    factoryOrOptions?: SuiteFactory | TestOptions,
    optionsOrFactory?: number | TestOptions | SuiteFactory,
  ) {
    const mode: RunMode = this.only
      ? 'only'
      : this.skip
        ? 'skip'
        : this.todo
          ? 'todo'
          : 'run'
    const currentSuite: SuiteCollector | undefined = collectorContext.currentSuite || defaultSuite

    let { options, handler: factory } = parseArguments(
      factoryOrOptions,
      optionsOrFactory,
    )

    const isConcurrentSpecified = options.concurrent || this.concurrent || options.sequential === false
    const isSequentialSpecified = options.sequential || this.sequential || options.concurrent === false

    // inherit options from current suite
    options = {
      ...currentSuite?.options,
      ...options,
      shuffle: this.shuffle ?? options.shuffle ?? currentSuite?.options?.shuffle ?? runner?.config.sequence.shuffle,
    }

    // inherit concurrent / sequential from suite
    const isConcurrent = isConcurrentSpecified || (options.concurrent && !isSequentialSpecified)
    const isSequential = isSequentialSpecified || (options.sequential && !isConcurrentSpecified)
    options.concurrent = isConcurrent && !isSequential
    options.sequential = isSequential && !isConcurrent

    return createSuiteCollector(
      formatName(name),
      factory,
      mode,
      this.each,
      options,
      currentSuite?.fixtures(),
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

      const fnFirst = typeof optionsOrFn === 'function' && typeof fnOrOptions === 'object'

      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]
        if (fnFirst) {
          if (arrayOnlyCases) {
            suite(
              formatTitle(_name, items, idx),
              () => handler(...items),
              options,
            )
          }
          else {
            suite(formatTitle(_name, items, idx), () => handler(i), options)
          }
        }
        else {
          if (arrayOnlyCases) {
            suite(formatTitle(_name, items, idx), options, () => handler(...items))
          }
          else {
            suite(formatTitle(_name, items, idx), options, () => handler(i))
          }
        }
      })

      this.setContext('each', undefined)
    }
  }

  suiteFn.for = function <T>(
    this: {
      withContext: () => SuiteAPI
      setContext: (key: string, value: boolean | undefined) => SuiteAPI
    },
    cases: ReadonlyArray<T>,
    ...args: any[]
  ) {
    if (Array.isArray(cases) && args.length) {
      cases = formatTemplateString(cases, args)
    }

    return (
      name: string | Function,
      optionsOrFn: ((...args: T[]) => void) | TestOptions,
      fnOrOptions?: ((...args: T[]) => void) | number | TestOptions,
    ) => {
      const name_ = formatName(name)
      const { options, handler } = parseArguments(optionsOrFn, fnOrOptions)
      cases.forEach((item, idx) => {
        suite(formatTitle(name_, toArray(item), idx), options, () => handler(item))
      })
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
): TestAPI {
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

      const fnFirst = typeof optionsOrFn === 'function' && typeof fnOrOptions === 'object'

      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]

        if (fnFirst) {
          if (arrayOnlyCases) {
            test(
              formatTitle(_name, items, idx),
              () => handler(...items),
              options,
            )
          }
          else {
            test(formatTitle(_name, items, idx), () => handler(i), options)
          }
        }
        else {
          if (arrayOnlyCases) {
            test(formatTitle(_name, items, idx), options, () => handler(...items))
          }
          else {
            test(formatTitle(_name, items, idx), options, () => handler(i))
          }
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

  taskFn.scoped = function (fixtures: Fixtures<Record<string, any>>) {
    const collector = getCurrentSuite()
    collector.scoped(fixtures)
  }

  taskFn.extend = function (fixtures: Fixtures<Record<string, any>>) {
    const _context = mergeContextFixtures(
      fixtures,
      context || {},
      runner,
    )

    const originalWrapper = fn
    return createTest(function (
      name: string | Function,
      optionsOrFn?: TestOptions | TestFunction,
      optionsOrTest?: number | TestOptions | TestFunction,
    ) {
      const collector = getCurrentSuite()
      const scopedFixtures = collector.fixtures()
      const context = { ...this }
      if (scopedFixtures) {
        context.fixtures = mergeScopedFixtures(
          context.fixtures || [],
          scopedFixtures,
        )
      }
      const { handler, options } = parseArguments(optionsOrFn, optionsOrTest)
      const timeout = options.timeout ?? runner?.config.testTimeout
      originalWrapper.call(context, formatName(name), handler, timeout)
    }, _context)
  }

  const _test = createChainable(
    ['concurrent', 'sequential', 'skip', 'only', 'todo', 'fails'],
    taskFn,
  ) as TestAPI

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
    : typeof name === 'function'
      ? name.name || '<anonymous>'
      : String(name)
}

function formatTitle(template: string, items: any[], idx: number) {
  if (template.includes('%#') || template.includes('%$')) {
    // '%#' match index of the test case
    template = template
      .replace(/%%/g, '__vitest_escaped_%__')
      .replace(/%#/g, `${idx}`)
      .replace(/%\$/g, `${idx + 1}`)
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
  const isObjectItem = isObject(items[0])
  formatted = formatted.replace(
    /\$([$\w.]+)/g,
    (_, key: string) => {
      const isArrayKey = /^\d+$/.test(key)
      if (!isObjectItem && !isArrayKey) {
        return `$${key}`
      }
      const arrayElement = isArrayKey ? objectAttr(items, key) : undefined
      const value = isObjectItem ? objectAttr(items[0], key, arrayElement) : arrayElement
      return objDisplay(value, {
        truncate: runner?.config?.chaiConfig?.truncateThreshold,
      }) as unknown as string
    },
  )
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

function findTestFileStackTrace(error: string) {
  const testFilePath = getTestFilepath()
  // first line is the error message
  const lines = error.split('\n').slice(1)
  for (const line of lines) {
    const stack = parseSingleStack(line)
    if (stack && stack.file === testFilePath) {
      return {
        line: stack.line,
        column: stack.column,
      }
    }
  }
}
