import type { WithFixturesOptions } from './fixture'
import type {
  AfterAllListener,
  AfterEachListener,
  AroundAllListener,
  AroundEachListener,
  BeforeAllListener,
  BeforeEachListener,
  File,
  InternalChainableContext,
  OnTestFailedHandler,
  OnTestFinishedHandler,
  RegisteredAroundAllListener,
  Suite,
  TaskHook,
  TaskPopulated,
  TestContext,
} from './types/tasks'
import { assertTypes } from '@vitest/utils/helpers'
import { abortContextSignal, abortIfTimeout, withTimeout } from './context'
import { configureProps, withFixtures } from './fixture'
import { getCurrentSuite, getRunner } from './suite'
import { getCurrentTest } from './test-state'
import { getChainableContext } from './utils/chain'

function getDefaultHookTimeout() {
  return getRunner().config.hookTimeout
}

const CLEANUP_TIMEOUT_KEY = Symbol.for('VITEST_CLEANUP_TIMEOUT')
const CLEANUP_STACK_TRACE_KEY = Symbol.for('VITEST_CLEANUP_STACK_TRACE')
const AROUND_TIMEOUT_KEY = Symbol.for('VITEST_AROUND_TIMEOUT')
const AROUND_STACK_TRACE_KEY = Symbol.for('VITEST_AROUND_STACK_TRACE')

export function getBeforeHookCleanupCallback(hook: Function, result: any, context?: TestContext): Function | undefined {
  if (typeof result === 'function') {
    const timeout
      = CLEANUP_TIMEOUT_KEY in hook && typeof hook[CLEANUP_TIMEOUT_KEY] === 'number'
        ? hook[CLEANUP_TIMEOUT_KEY]
        : getDefaultHookTimeout()
    const stackTraceError
      = CLEANUP_STACK_TRACE_KEY in hook && hook[CLEANUP_STACK_TRACE_KEY] instanceof Error
        ? hook[CLEANUP_STACK_TRACE_KEY]
        : undefined
    return withTimeout(
      result,
      timeout,
      true,
      stackTraceError,
      (_, error) => {
        if (context) {
          abortContextSignal(context, error)
        }
      },
    )
  }
}

/**
 * Registers a callback function to be executed once before all tests within the current suite.
 * This hook is useful for scenarios where you need to perform setup operations that are common to all tests in a suite, such as initializing a database connection or setting up a test environment.
 *
 * **Note:** The `beforeAll` hooks are executed in the order they are defined one after another. You can configure this by changing the `sequence.hooks` option in the config file.
 *
 * @param {Function} fn - The callback function to be executed before all tests.
 * @param {number} [timeout] - Optional timeout in milliseconds for the hook. If not provided, the default hook timeout from the runner's configuration is used.
 * @returns {void}
 * @example
 * ```ts
 * // Example of using beforeAll to set up a database connection
 * beforeAll(async () => {
 *   await database.connect();
 * });
 * ```
 */
export function beforeAll<ExtraContext = object>(
  this: unknown,
  fn: BeforeAllListener<ExtraContext>,
  timeout: number = getDefaultHookTimeout(),
): void {
  assertTypes(fn, '"beforeAll" callback', ['function'])
  const stackTraceError = new Error('STACK_TRACE_ERROR')
  const context = getChainableContext(this)
  return getCurrentSuite<ExtraContext>().on(
    'beforeAll',
    Object.assign(
      withTimeout(
        withSuiteFixtures('beforeAll', fn, context, stackTraceError),
        timeout,
        true,
        stackTraceError,
      ),
      {
        [CLEANUP_TIMEOUT_KEY]: timeout,
        [CLEANUP_STACK_TRACE_KEY]: stackTraceError,
      },
    ),
  )
}

/**
 * Registers a callback function to be executed once after all tests within the current suite have completed.
 * This hook is useful for scenarios where you need to perform cleanup operations after all tests in a suite have run, such as closing database connections or cleaning up temporary files.
 *
 * **Note:** The `afterAll` hooks are running in reverse order of their registration. You can configure this by changing the `sequence.hooks` option in the config file.
 *
 * @param {Function} fn - The callback function to be executed after all tests.
 * @param {number} [timeout] - Optional timeout in milliseconds for the hook. If not provided, the default hook timeout from the runner's configuration is used.
 * @returns {void}
 * @example
 * ```ts
 * // Example of using afterAll to close a database connection
 * afterAll(async () => {
 *   await database.disconnect();
 * });
 * ```
 */
export function afterAll<ExtraContext = object>(
  this: unknown,
  fn: AfterAllListener<ExtraContext>,
  timeout?: number,
): void {
  assertTypes(fn, '"afterAll" callback', ['function'])
  const context = getChainableContext(this)
  const stackTraceError = new Error('STACK_TRACE_ERROR')
  return getCurrentSuite<ExtraContext>().on(
    'afterAll',
    withTimeout(
      withSuiteFixtures('afterAll', fn, context, stackTraceError),
      timeout ?? getDefaultHookTimeout(),
      true,
      stackTraceError,
    ),
  )
}

/**
 * Registers a callback function to be executed before each test within the current suite.
 * This hook is useful for scenarios where you need to reset or reinitialize the test environment before each test runs, such as resetting database states, clearing caches, or reinitializing variables.
 *
 * **Note:** The `beforeEach` hooks are executed in the order they are defined one after another. You can configure this by changing the `sequence.hooks` option in the config file.
 *
 * @param {Function} fn - The callback function to be executed before each test. This function receives an `TestContext` parameter if additional test context is needed.
 * @param {number} [timeout] - Optional timeout in milliseconds for the hook. If not provided, the default hook timeout from the runner's configuration is used.
 * @returns {void}
 * @example
 * ```ts
 * // Example of using beforeEach to reset a database state
 * beforeEach(async () => {
 *   await database.reset();
 * });
 * ```
 */
export function beforeEach<ExtraContext = object>(
  fn: BeforeEachListener<ExtraContext>,
  timeout: number = getDefaultHookTimeout(),
): void {
  assertTypes(fn, '"beforeEach" callback', ['function'])
  const stackTraceError = new Error('STACK_TRACE_ERROR')
  return getCurrentSuite<ExtraContext>().on(
    'beforeEach',
    Object.assign(
      withTimeout(
        withFixtures(fn),
        timeout ?? getDefaultHookTimeout(),
        true,
        stackTraceError,
        abortIfTimeout,
      ),
      {
        [CLEANUP_TIMEOUT_KEY]: timeout,
        [CLEANUP_STACK_TRACE_KEY]: stackTraceError,
      },
    ),
  )
}

/**
 * Registers a callback function to be executed after each test within the current suite has completed.
 * This hook is useful for scenarios where you need to clean up or reset the test environment after each test runs, such as deleting temporary files, clearing test-specific database entries, or resetting mocked functions.
 *
 * **Note:** The `afterEach` hooks are running in reverse order of their registration. You can configure this by changing the `sequence.hooks` option in the config file.
 *
 * @param {Function} fn - The callback function to be executed after each test. This function receives an `TestContext` parameter if additional test context is needed.
 * @param {number} [timeout] - Optional timeout in milliseconds for the hook. If not provided, the default hook timeout from the runner's configuration is used.
 * @returns {void}
 * @example
 * ```ts
 * // Example of using afterEach to delete temporary files created during a test
 * afterEach(async () => {
 *   await fileSystem.deleteTempFiles();
 * });
 * ```
 */
export function afterEach<ExtraContext = object>(
  fn: AfterEachListener<ExtraContext>,
  timeout?: number,
): void {
  assertTypes(fn, '"afterEach" callback', ['function'])
  return getCurrentSuite<ExtraContext>().on(
    'afterEach',
    withTimeout(
      withFixtures(fn),
      timeout ?? getDefaultHookTimeout(),
      true,
      new Error('STACK_TRACE_ERROR'),
      abortIfTimeout,
    ),
  )
}

/**
 * Registers a callback function to be executed when a test fails within the current suite.
 * This function allows for custom actions to be performed in response to test failures, such as logging, cleanup, or additional diagnostics.
 *
 * **Note:** The `onTestFailed` hooks are running in reverse order of their registration. You can configure this by changing the `sequence.hooks` option in the config file.
 *
 * @param {Function} fn - The callback function to be executed upon a test failure. The function receives the test result (including errors).
 * @param {number} [timeout] - Optional timeout in milliseconds for the hook. If not provided, the default hook timeout from the runner's configuration is used.
 * @throws {Error} Throws an error if the function is not called within a test.
 * @returns {void}
 * @example
 * ```ts
 * // Example of using onTestFailed to log failure details
 * onTestFailed(({ errors }) => {
 *   console.log(`Test failed: ${test.name}`, errors);
 * });
 * ```
 */
export const onTestFailed: TaskHook<OnTestFailedHandler> = createTestHook(
  'onTestFailed',
  (test, handler, timeout) => {
    test.onFailed ||= []
    test.onFailed.push(
      withTimeout(
        handler,
        timeout ?? getDefaultHookTimeout(),
        true,
        new Error('STACK_TRACE_ERROR'),
        abortIfTimeout,
      ),
    )
  },
)

/**
 * Registers a callback function to be executed when the current test finishes, regardless of the outcome (pass or fail).
 * This function is ideal for performing actions that should occur after every test execution, such as cleanup, logging, or resetting shared resources.
 *
 * This hook is useful if you have access to a resource in the test itself and you want to clean it up after the test finishes. It is a more compact way to clean up resources than using the combination of `beforeEach` and `afterEach`.
 *
 * **Note:** The `onTestFinished` hooks are running in reverse order of their registration. You can configure this by changing the `sequence.hooks` option in the config file.
 *
 * **Note:** The `onTestFinished` hook is not called if the test is canceled with a dynamic `ctx.skip()` call.
 *
 * @param {Function} fn - The callback function to be executed after a test finishes. The function can receive parameters providing details about the completed test, including its success or failure status.
 * @param {number} [timeout] - Optional timeout in milliseconds for the hook. If not provided, the default hook timeout from the runner's configuration is used.
 * @throws {Error} Throws an error if the function is not called within a test.
 * @returns {void}
 * @example
 * ```ts
 * // Example of using onTestFinished for cleanup
 * const db = await connectToDatabase();
 * onTestFinished(async () => {
 *   await db.disconnect();
 * });
 * ```
 */
export const onTestFinished: TaskHook<OnTestFinishedHandler> = createTestHook(
  'onTestFinished',
  (test, handler, timeout) => {
    test.onFinished ||= []
    test.onFinished.push(
      withTimeout(
        handler,
        timeout ?? getDefaultHookTimeout(),
        true,
        new Error('STACK_TRACE_ERROR'),
        abortIfTimeout,
      ),
    )
  },
)

/**
 * Registers a callback function that wraps around all tests within the current suite.
 * The callback receives a `runSuite` function that must be called to run the suite's tests.
 * This hook is useful for scenarios where you need to wrap an entire suite in a context
 * (e.g., starting a server, opening a database connection that all tests share).
 *
 * **Note:** When multiple `aroundAll` hooks are registered, they are nested inside each other.
 * The first registered hook is the outermost wrapper.
 *
 * @param {Function} fn - The callback function that wraps the suite. Must call `runSuite()` to run the tests.
 * @param {number} [timeout] - Optional timeout in milliseconds for the hook. If not provided, the default hook timeout from the runner's configuration is used.
 * @returns {void}
 * @example
 * ```ts
 * // Example of using aroundAll to wrap suite in a tracing span
 * aroundAll(async (runSuite) => {
 *   await tracer.trace('test-suite', runSuite);
 * });
 * ```
 * @example
 * ```ts
 * // Example of using aroundAll with fixtures
 * aroundAll(async (runSuite, { db }) => {
 *   await db.transaction(() => runSuite());
 * });
 * ```
 */
export function aroundAll<ExtraContext = object>(
  this: unknown,
  fn: AroundAllListener<ExtraContext>,
  timeout?: number,
): void {
  assertTypes(fn, '"aroundAll" callback', ['function'])
  const stackTraceError = new Error('STACK_TRACE_ERROR')
  const resolvedTimeout = timeout ?? getDefaultHookTimeout()
  const context = getChainableContext(this)

  return getCurrentSuite().on(
    'aroundAll',
    Object.assign(
      withSuiteFixtures(
        'aroundAll',
        fn,
        context,
        stackTraceError,
        1,
      ) as RegisteredAroundAllListener,
      {
        [AROUND_TIMEOUT_KEY]: resolvedTimeout,
        [AROUND_STACK_TRACE_KEY]: stackTraceError,
      },
    ),
  )
}

/**
 * Registers a callback function that wraps around each test within the current suite.
 * The callback receives a `runTest` function that must be called to run the test.
 * This hook is useful for scenarios where you need to wrap tests in a context (e.g., database transactions).
 *
 * **Note:** When multiple `aroundEach` hooks are registered, they are nested inside each other.
 * The first registered hook is the outermost wrapper.
 *
 * @param {Function} fn - The callback function that wraps the test. Must call `runTest()` to run the test.
 * @param {number} [timeout] - Optional timeout in milliseconds for the hook. If not provided, the default hook timeout from the runner's configuration is used.
 * @returns {void}
 * @example
 * ```ts
 * // Example of using aroundEach to wrap tests in a database transaction
 * aroundEach(async (runTest) => {
 *   await database.transaction(() => runTest());
 * });
 * ```
 * @example
 * ```ts
 * // Example of using aroundEach with fixtures
 * aroundEach(async (runTest, { db }) => {
 *   await db.transaction(() => runTest());
 * });
 * ```
 */
export function aroundEach<ExtraContext = object>(
  fn: AroundEachListener<ExtraContext>,
  timeout?: number,
): void {
  assertTypes(fn, '"aroundEach" callback', ['function'])
  const stackTraceError = new Error('STACK_TRACE_ERROR')
  const resolvedTimeout = timeout ?? getDefaultHookTimeout()

  const wrapper: AroundEachListener<ExtraContext> = (runTest, context, suite) => {
    const innerFn = (ctx: any) => fn(runTest, ctx, suite)
    configureProps(innerFn, { index: 1, original: fn })

    const fixtureResolver = withFixtures(innerFn)
    return fixtureResolver(context)
  }

  return getCurrentSuite<ExtraContext>().on(
    'aroundEach',
    Object.assign(
      wrapper,
      {
        [AROUND_TIMEOUT_KEY]: resolvedTimeout,
        [AROUND_STACK_TRACE_KEY]: stackTraceError,
      },
    ),
  )
}

function withSuiteFixtures(
  suiteHook: WithFixturesOptions['suiteHook'],
  fn: Function,
  context: InternalChainableContext | undefined,
  stackTraceError: Error,
  contextIndex = 0,
) {
  return (...args: any[]) => {
    const suite = args.at(-1) as Suite | File
    const prefix = args.slice(0, -1) // this is potential "runSuite"

    const wrapper = (ctx: any) => fn(...prefix, ctx, suite)
    configureProps(wrapper, { index: contextIndex, original: fn })

    const fixtures = context?.getFixtures()
    const fileContext = fixtures?.getFileContext(suite.file)

    const fixtured = withFixtures(wrapper, {
      suiteHook,
      fixtures,
      context: fileContext,
      stackTraceError,
    })
    return fixtured()
  }
}

export function getAroundHookTimeout(hook: Function): number {
  return AROUND_TIMEOUT_KEY in hook && typeof hook[AROUND_TIMEOUT_KEY] === 'number'
    ? hook[AROUND_TIMEOUT_KEY]
    : getDefaultHookTimeout()
}

export function getAroundHookStackTrace(hook: Function): Error | undefined {
  return AROUND_STACK_TRACE_KEY in hook && hook[AROUND_STACK_TRACE_KEY] instanceof Error
    ? hook[AROUND_STACK_TRACE_KEY]
    : undefined
}

function createTestHook<T>(
  name: string,
  handler: (test: TaskPopulated, handler: T, timeout?: number) => void,
): TaskHook<T> {
  return (fn: T, timeout?: number) => {
    assertTypes(fn, `"${name}" callback`, ['function'])

    const current = getCurrentTest()

    if (!current) {
      throw new Error(`Hook ${name}() can only be called inside a test`)
    }

    return handler(current, fn, timeout)
  }
}
