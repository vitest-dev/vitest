import type { UserFixtures } from './fixture'
import type { VitestRunner } from './types/runner'
import type {
  File,
  InternalTestContext,
  RunMode,
  Suite,
  SuiteAPI,
  SuiteCollector,
  SuiteFactory,
  SuiteHooks,
  SuiteOptions,
  Task,
  TaskCustomOptions,
  TaskPopulated,
  Test,
  TestAPI,
  TestFunction,
  TestOptions,
} from './types/tasks'
import { format, formatRegExp, objDisplay } from '@vitest/utils/display'
import {
  isNegativeNaN,
  isObject,
  objectAttr,
  toArray,
  unique,
} from '@vitest/utils/helpers'
import {
  abortIfTimeout,
  collectorContext,
  collectTask,
  createTestContext,
  runWithSuite,
  withCancel,
  withTimeout,
} from './context'
import { configureProps, TestFixtures, withFixtures } from './fixture'
import { afterAll, afterEach, aroundAll, aroundEach, beforeAll, beforeEach } from './hooks'
import { getHooks, setFn, setHooks, setTestFixture } from './map'
import { getCurrentTest } from './test-state'
import { findTestFileStackTrace } from './utils'
import { createChainable, getChainableContext } from './utils/chain'
import { createNoTagsError, validateTags } from './utils/tags'
import { createTaskName } from './utils/tasks'

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
    throw new Error(
      `Vitest failed to find ${message}. One of the following is possible:`
      + '\n- "vitest" is imported directly without running "vitest" command'
      + '\n- "vitest" is imported inside "globalSetup" (to fix this, use "setupFiles" instead, because "globalSetup" runs in a different context)'
      + '\n- "vitest" is imported inside Vite / Vitest config file'
      + '\n- Otherwise, it might be a Vitest bug. Please report it to https://github.com/vitest-dev/vitest/issues\n',
    )
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
  const options: SuiteOptions = {}
  if (config.concurrent != null) {
    options.concurrent = config.concurrent
  }
  const collector = suite('', options, () => {})
  // no parent suite for top-level tests
  delete collector.suite
  return collector
}

export function clearCollectorContext(
  file: File,
  currentRunner: VitestRunner,
): void {
  currentTestFilepath = file.filepath
  runner = currentRunner
  if (!defaultSuite) {
    defaultSuite = createDefaultSuite(currentRunner)
  }
  defaultSuite.file = file
  collectorContext.tasks.length = 0
  defaultSuite.clear()
  collectorContext.currentSuite = defaultSuite
}

export function getCurrentSuite<ExtraContext = object>(): SuiteCollector<ExtraContext> {
  const currentSuite = (collectorContext.currentSuite
    || defaultSuite) as unknown as SuiteCollector<ExtraContext>
  assert(currentSuite, 'the current suite')
  return currentSuite
}

export function createSuiteHooks(): SuiteHooks {
  return {
    beforeAll: [],
    afterAll: [],
    beforeEach: [],
    afterEach: [],
    aroundEach: [],
    aroundAll: [],
  }
}

const POSITIVE_INFINITY = Number.POSITIVE_INFINITY

function parseArguments<T extends (...args: any[]) => any>(
  optionsOrFn: T | object | undefined,
  timeoutOrTest: T | number | undefined,
) {
  if (timeoutOrTest != null && typeof timeoutOrTest === 'object') {
    throw new TypeError(`Signature "test(name, fn, { ... })" was deprecated in Vitest 3 and removed in Vitest 4. Please, provide options as a second argument instead.`)
  }

  let options: TestOptions = {}
  let fn: T | undefined

  // it('', () => {}, 1000)
  if (typeof timeoutOrTest === 'number') {
    options = { timeout: timeoutOrTest }
  }
  // it('', { retry: 2 }, () => {})
  else if (typeof optionsOrFn === 'object') {
    options = optionsOrFn
  }

  if (typeof optionsOrFn === 'function') {
    if (typeof timeoutOrTest === 'function') {
      throw new TypeError(
        'Cannot use two functions as arguments. Please use the second argument for options.',
      )
    }
    fn = optionsOrFn as T
  }
  else if (typeof timeoutOrTest === 'function') {
    fn = timeoutOrTest as T
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
  suiteOptions?: SuiteOptions,
) {
  const tasks: (Test | Suite | SuiteCollector)[] = []

  let suite!: Suite
  initSuite(true)

  const task = function (name = '', options: TaskCustomOptions = {}) {
    const currentSuite = collectorContext.currentSuite?.suite
    const parentTask = currentSuite ?? collectorContext.currentSuite?.file
    const parentTags = parentTask?.tags || []
    const testTags = unique([...parentTags, ...toArray(options.tags)])
    const tagsOptions = testTags
      .map((tag) => {
        const tagDefinition = runner.config.tags?.find(t => t.name === tag)
        if (!tagDefinition && runner.config.strictTags) {
          throw createNoTagsError(runner.config.tags, tag)
        }
        return tagDefinition
      })
      .filter(r => r != null)
      // higher priority should be last, run 1, 2, 3, ... etc
      .sort((tag1, tag2) => (tag2.priority ?? POSITIVE_INFINITY) - (tag1.priority ?? POSITIVE_INFINITY))
      .reduce((acc, tag) => {
        const { name, description, priority, meta, ...options } = tag
        Object.assign(acc, options)
        if (meta) {
          acc.meta = Object.assign(acc.meta ?? Object.create(null), meta)
        }
        return acc
      }, {} as TestOptions)

    const testOwnMeta = options.meta
    options = {
      ...tagsOptions,
      ...options,
    }
    const timeout = options.timeout ?? runner.config.testTimeout
    const parentMeta = currentSuite?.meta
    const tagMeta = tagsOptions.meta
    const testMeta = Object.create(null)
    if (tagMeta) {
      Object.assign(testMeta, tagMeta)
    }
    if (parentMeta) {
      Object.assign(testMeta, parentMeta)
    }
    if (testOwnMeta) {
      Object.assign(testMeta, testOwnMeta)
    }
    const task: Test = {
      id: '',
      name,
      fullName: createTaskName([
        currentSuite?.fullName ?? collectorContext.currentSuite?.file?.fullName,
        name,
      ]),
      fullTestName: createTaskName([currentSuite?.fullTestName, name]),
      suite: currentSuite,
      each: options.each,
      fails: options.fails,
      context: undefined!,
      type: 'test',
      file: (currentSuite?.file ?? collectorContext.currentSuite?.file)!,
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
      meta: testMeta,
      annotations: [],
      artifacts: [],
      tags: testTags,
    }
    const handler = options.handler
    if (task.mode === 'run' && !handler) {
      task.mode = 'todo'
    }
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
    setTestFixture(context, options.fixtures ?? new TestFixtures())

    const limit = Error.stackTraceLimit
    Error.stackTraceLimit = 10
    const stackTraceError = new Error('STACK_TRACE_ERROR')
    Error.stackTraceLimit = limit

    if (handler) {
      setFn(
        task,
        withTimeout(
          withCancel(withAwaitAsyncAssertions(withFixtures(handler, { context }), task), task.context.signal),
          timeout,
          false,
          stackTraceError,
          (_, error) => abortIfTimeout([context], error),
        ),
      )
    }

    if (runner.config.includeTaskLocation) {
      const error = stackTraceError.stack!
      const stack = findTestFileStackTrace(currentTestFilepath, error)
      if (stack) {
        task.location = {
          line: stack.line,
          column: stack.column,
        }
      }
    }

    tasks.push(task)
    return task
  }

  const test = createTest(function (
    name: string | Function,
    optionsOrFn?: TestOptions | TestFunction,
    timeoutOrTest?: number | TestFunction,
  ) {
    let { options, handler } = parseArguments(optionsOrFn, timeoutOrTest)

    // inherit repeats, retry, timeout from suite
    if (typeof suiteOptions === 'object') {
      options = Object.assign({}, suiteOptions, options)
    }

    // inherit concurrent / sequential from suite
    const concurrent = this.concurrent ?? (!this.sequential && options?.concurrent)
    if (options.concurrent != null && concurrent != null) {
      options.concurrent = concurrent
    }

    const sequential = this.sequential ?? (!this.concurrent && options?.sequential)
    if (options.sequential != null && sequential != null) {
      options.sequential = sequential
    }

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
    suite,
    options: suiteOptions,
    test,
    file: suite.file,
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

    const currentSuite = collectorContext.currentSuite?.suite
    const parentTask = currentSuite ?? collectorContext.currentSuite?.file
    const suiteTags = toArray(suiteOptions?.tags)
    validateTags(runner.config, suiteTags)

    suite = {
      id: '',
      type: 'suite',
      name,
      fullName: createTaskName([
        currentSuite?.fullName ?? collectorContext.currentSuite?.file?.fullName,
        name,
      ]),
      fullTestName: createTaskName([currentSuite?.fullTestName, name]),
      suite: currentSuite,
      mode,
      each,
      file: (currentSuite?.file ?? collectorContext.currentSuite?.file)!,
      shuffle: suiteOptions?.shuffle,
      tasks: [],
      meta: suiteOptions?.meta ?? Object.create(null),
      concurrent: suiteOptions?.concurrent,
      tags: unique([...parentTask?.tags || [], ...suiteTags]),
    }

    if (runner && includeLocation && runner.config.includeTaskLocation) {
      const limit = Error.stackTraceLimit
      Error.stackTraceLimit = 15
      const error = new Error('stacktrace').stack!
      Error.stackTraceLimit = limit
      const stack = findTestFileStackTrace(currentTestFilepath, error)
      if (stack) {
        suite.location = {
          line: stack.line,
          column: stack.column,
        }
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

    suite.tasks = allChildren

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
    factoryOrOptions?: SuiteFactory | SuiteOptions,
    optionsOrFactory?: number | SuiteFactory,
  ) {
    if (getCurrentTest()) {
      throw new Error(
        'Calling the suite function inside test function is not allowed. It can be only called at the top level or inside another suite function.',
      )
    }

    const currentSuite: SuiteCollector | undefined = collectorContext.currentSuite || defaultSuite

    let { options, handler: factory } = parseArguments(
      factoryOrOptions,
      optionsOrFactory,
    ) as { options: SuiteOptions; handler: SuiteFactory | undefined }

    const isConcurrentSpecified = options.concurrent || this.concurrent || options.sequential === false
    const isSequentialSpecified = options.sequential || this.sequential || options.concurrent === false

    const { meta: parentMeta, ...parentOptions } = currentSuite?.options || {}
    // inherit options from current suite
    options = {
      ...parentOptions,
      ...options,
    }

    const shuffle = this.shuffle ?? options.shuffle ?? currentSuite?.options?.shuffle ?? runner?.config.sequence.shuffle
    if (shuffle != null) {
      options.shuffle = shuffle
    }

    let mode: RunMode = (this.only ?? options.only)
      ? 'only'
      : (this.skip ?? options.skip)
          ? 'skip'
          : (this.todo ?? options.todo)
              ? 'todo'
              : 'run'

    // passed as test(name), assume it's a "todo"
    if (mode === 'run' && !factory) {
      mode = 'todo'
    }

    // inherit concurrent / sequential from suite
    const isConcurrent = isConcurrentSpecified || (options.concurrent && !isSequentialSpecified)
    const isSequential = isSequentialSpecified || (options.sequential && !isConcurrentSpecified)
    if (isConcurrent != null) {
      options.concurrent = isConcurrent && !isSequential
    }
    if (isSequential != null) {
      options.sequential = isSequential && !isConcurrent
    }

    if (parentMeta) {
      options.meta = Object.assign(Object.create(null), parentMeta, options.meta)
    }

    return createSuiteCollector(
      formatName(name),
      factory,
      mode,
      this.each,
      options,
    )
  }

  suiteFn.each = function <T>(
    this: SuiteAPI,
    cases: ReadonlyArray<T>,
    ...args: any[]
  ) {
    const context = getChainableContext(this)
    const suite = context.withContext()
    context.setContext('each', true)

    if (Array.isArray(cases) && args.length) {
      cases = formatTemplateString(cases, args)
    }

    return (
      name: string | Function,
      optionsOrFn: ((...args: T[]) => void) | TestOptions,
      fnOrOptions?: ((...args: T[]) => void) | number,
    ) => {
      const _name = formatName(name)
      const arrayOnlyCases = cases.every(Array.isArray)

      const { options, handler } = parseArguments(optionsOrFn, fnOrOptions)

      const fnFirst = typeof optionsOrFn === 'function'

      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]
        if (fnFirst) {
          if (arrayOnlyCases) {
            suite(
              formatTitle(_name, items, idx),
              handler ? () => handler(...items) : undefined,
              options.timeout,
            )
          }
          else {
            suite(formatTitle(_name, items, idx), handler ? () => handler(i) : undefined, options.timeout)
          }
        }
        else {
          if (arrayOnlyCases) {
            suite(formatTitle(_name, items, idx), options, handler ? () => handler(...items) : undefined)
          }
          else {
            suite(formatTitle(_name, items, idx), options, handler ? () => handler(i) : undefined)
          }
        }
      })

      context.setContext('each', undefined)
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
      fnOrOptions?: ((...args: T[]) => void) | number,
    ) => {
      const name_ = formatName(name)
      const { options, handler } = parseArguments(optionsOrFn, fnOrOptions)
      cases.forEach((item, idx) => {
        suite(formatTitle(name_, toArray(item), idx), options, handler ? () => handler(item) : undefined)
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
): TestAPI {
  const taskFn = fn as any

  taskFn.each = function <T>(
    this: TestAPI,
    cases: ReadonlyArray<T>,
    ...args: any[]
  ) {
    const context = getChainableContext(this)
    const test = context.withContext()
    context.setContext('each', true)

    if (Array.isArray(cases) && args.length) {
      cases = formatTemplateString(cases, args)
    }

    return (
      name: string | Function,
      optionsOrFn: ((...args: T[]) => void) | TestOptions,
      fnOrOptions?: ((...args: T[]) => void) | number,
    ) => {
      const _name = formatName(name)
      const arrayOnlyCases = cases.every(Array.isArray)

      const { options, handler } = parseArguments(optionsOrFn, fnOrOptions)

      const fnFirst = typeof optionsOrFn === 'function'

      cases.forEach((i, idx) => {
        const items = Array.isArray(i) ? i : [i]

        if (fnFirst) {
          if (arrayOnlyCases) {
            test(
              formatTitle(_name, items, idx),
              handler ? () => handler(...items) : undefined,
              options.timeout,
            )
          }
          else {
            test(formatTitle(_name, items, idx), handler ? () => handler(i) : undefined, options.timeout)
          }
        }
        else {
          if (arrayOnlyCases) {
            test(formatTitle(_name, items, idx), options, handler ? () => handler(...items) : undefined)
          }
          else {
            test(formatTitle(_name, items, idx), options, handler ? () => handler(i) : undefined)
          }
        }
      })

      context.setContext('each', undefined)
    }
  }

  taskFn.for = function <T>(
    this: TestAPI,
    cases: ReadonlyArray<T>,
    ...args: any[]
  ) {
    const context = getChainableContext(this)
    const test = context.withContext()

    if (Array.isArray(cases) && args.length) {
      cases = formatTemplateString(cases, args)
    }

    return (
      name: string | Function,
      optionsOrFn: ((...args: T[]) => void) | TestOptions,
      fnOrOptions?: ((...args: T[]) => void) | number,
    ) => {
      const _name = formatName(name)
      const { options, handler } = parseArguments(optionsOrFn, fnOrOptions)
      cases.forEach((item, idx) => {
        // monkey-patch handler to allow parsing fixture
        const handlerWrapper = handler ? (ctx: any) => handler(item, ctx) : undefined
        if (handlerWrapper) {
          configureProps(handlerWrapper, { index: 1, original: handler })
        }
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

  /**
   * Parse builder pattern arguments into a fixtures object.
   * Handles both builder pattern (name, options?, value) and object syntax.
   */
  function parseBuilderFixtures(
    fixturesOrName: UserFixtures | string,
    optionsOrFn?: object | ((...args: any[]) => any),
    maybeFn?: (...args: any[]) => any,
  ): UserFixtures {
    // Object syntax: just return as-is
    if (typeof fixturesOrName !== 'string') {
      return fixturesOrName
    }

    const fixtureName = fixturesOrName
    let fixtureOptions: object | undefined
    let fixtureValue: any

    if (maybeFn !== undefined) {
      // (name, options, value) or (name, options, fn)
      fixtureOptions = optionsOrFn as object
      fixtureValue = maybeFn
    }
    else {
      // (name, value) or (name, fn)
      // Check if optionsOrFn looks like fixture options (has scope or auto)
      if (
        optionsOrFn !== null
        && typeof optionsOrFn === 'object'
        && !Array.isArray(optionsOrFn)
        && ('scope' in optionsOrFn || 'auto' in optionsOrFn)
      ) {
        // (name, options) with no value - treat as empty object fixture
        fixtureOptions = optionsOrFn as object
        fixtureValue = {}
      }
      else {
        // (name, value) or (name, fn)
        fixtureOptions = undefined
        fixtureValue = optionsOrFn
      }
    }

    // Function value: wrap with onCleanup pattern
    if (typeof fixtureValue === 'function') {
      const builderFn = fixtureValue as (...args: any[]) => any

      // Wrap builder pattern function (returns value) to use() pattern
      const fixture = async (ctx: any, use: (value: any) => Promise<void>) => {
        let cleanup: (() => any) | undefined
        const onCleanup = (fn: () => any) => {
          if (cleanup !== undefined) {
            throw new Error(
              `onCleanup can only be called once per fixture. `
              + `Define separate fixtures if you need multiple cleanup functions.`,
            )
          }
          cleanup = fn
        }
        const value = await builderFn(ctx, { onCleanup })
        await use(value)
        if (cleanup) {
          await cleanup()
        }
      }
      configureProps(fixture, { original: builderFn })

      if (fixtureOptions) {
        return { [fixtureName]: [fixture, fixtureOptions] } as any
      }
      return { [fixtureName]: fixture } as any
    }

    // Non-function value: use directly
    if (fixtureOptions) {
      return { [fixtureName]: [fixtureValue, fixtureOptions] } as any
    }
    return { [fixtureName]: fixtureValue } as any
  }

  taskFn.override = function (
    this: TestAPI,
    fixturesOrName: UserFixtures | string,
    optionsOrFn?: object | ((...args: any[]) => any),
    maybeFn?: (...args: any[]) => any,
  ) {
    const userFixtures = parseBuilderFixtures(fixturesOrName, optionsOrFn, maybeFn)
    getChainableContext(this).getFixtures().override(runner, userFixtures)
    return this
  }

  taskFn.scoped = function (fixtures: UserFixtures) {
    console.warn(`test.scoped() is deprecated and will be removed in future versions. Please use test.override() instead.`)
    return this.override(fixtures)
  }

  taskFn.extend = function (
    this: TestAPI,
    fixturesOrName: UserFixtures | string,
    optionsOrFn?: object | ((...args: any[]) => any),
    maybeFn?: (...args: any[]) => any,
  ) {
    const userFixtures = parseBuilderFixtures(fixturesOrName, optionsOrFn, maybeFn)
    const fixtures = getChainableContext(this).getFixtures().extend(
      runner,
      userFixtures,
    )

    const _test = createTest(function (
      name: string | Function,
      optionsOrFn?: TestOptions | TestFunction,
      optionsOrTest?: number | TestFunction,
    ) {
      fn.call(this, formatName(name), optionsOrFn, optionsOrTest)
    })
    getChainableContext(_test).mergeContext({ fixtures })

    return _test
  }

  taskFn.describe = suite
  taskFn.suite = suite
  taskFn.beforeEach = beforeEach
  taskFn.afterEach = afterEach
  taskFn.beforeAll = beforeAll
  taskFn.afterAll = afterAll
  taskFn.aroundEach = aroundEach
  taskFn.aroundAll = aroundAll

  const _test = createChainable(
    ['concurrent', 'sequential', 'skip', 'only', 'todo', 'fails'],
    taskFn,
    { fixtures: new TestFixtures() },
  ) as TestAPI

  return _test
}

function createTest(
  fn: (
    this: InternalTestContext,
    title: string,
    optionsOrFn?: TestOptions | TestFunction,
    optionsOrTest?: number | TestFunction,
  ) => void,
) {
  return createTaskCollector(fn) as TestAPI
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

  const isObjectItem = isObject(items[0])
  function formatAttribute(s: string) {
    return s.replace(/\$([$\w.]+)/g, (_, key: string) => {
      const isArrayKey = /^\d+$/.test(key)
      if (!isObjectItem && !isArrayKey) {
        return `$${key}`
      }
      const arrayElement = isArrayKey ? objectAttr(items, key) : undefined
      const value = isObjectItem ? objectAttr(items[0], key, arrayElement) : arrayElement
      return objDisplay(value, {
        truncate: runner?.config?.chaiConfig?.truncateThreshold,
      })
    })
  }

  let output = ''
  let i = 0
  handleRegexMatch(
    template,
    formatRegExp,
    // format "%"
    (match) => {
      if (i < count) {
        output += format(match[0], items[i++])
      }
      else {
        output += match[0]
      }
    },
    // format "$"
    (nonMatch) => {
      output += formatAttribute(nonMatch)
    },
  )
  return output
}

// based on https://github.com/unocss/unocss/blob/2e74b31625bbe3b9c8351570749aa2d3f799d919/packages/autocomplete/src/parse.ts#L11
function handleRegexMatch(
  input: string,
  regex: RegExp,
  onMatch: (match: RegExpMatchArray) => void,
  onNonMatch: (nonMatch: string) => void,
) {
  let lastIndex = 0
  for (const m of input.matchAll(regex)) {
    if (lastIndex < m.index) {
      onNonMatch(input.slice(lastIndex, m.index))
    }
    onMatch(m)
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < input.length) {
    onNonMatch(input.slice(lastIndex))
  }
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
