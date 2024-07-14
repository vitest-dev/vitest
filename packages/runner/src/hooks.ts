import type {
  OnTestFailedHandler,
  OnTestFinishedHandler,
  SuiteHooks,
  TaskPopulated,
} from './types/tasks'
import { getCurrentSuite, getRunner } from './suite'
import { getCurrentTest } from './test-state'
import { withTimeout } from './context'
import { withFixtures } from './fixture'

function getDefaultHookTimeout() {
  return getRunner().config.hookTimeout
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
 *
 * @example
 * // Example of using beforeAll to set up a database connection
 * beforeAll(async () => {
 *   await database.connect();
 * });
 *
 * @example
 * // Example of using beforeAll with a timeout
 * beforeAll(() => {
 *   // Initialization code that might take longer than the default timeout
 * }, 5000);
 */
export function beforeAll(fn: SuiteHooks['beforeAll'][0], timeout?: number): void {
  return getCurrentSuite().on(
    'beforeAll',
    withTimeout(fn, timeout ?? getDefaultHookTimeout(), true),
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
 *
 * @example
 * // Example of using afterAll to close a database connection
 * afterAll(async () => {
 *   await database.disconnect();
 * });
 *
 * @example
 * // Example of using afterAll with a timeout
 * afterAll(() => {
 *   // Cleanup code that might take longer than the default timeout
 * }, 5000);
 */
export function afterAll(fn: SuiteHooks['afterAll'][0], timeout?: number): void {
  return getCurrentSuite().on(
    'afterAll',
    withTimeout(fn, timeout ?? getDefaultHookTimeout(), true),
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
 *
 * @example
 * // Example of using beforeEach to reset a database state
 * beforeEach(async () => {
 *   await database.reset();
 * });
 */
export function beforeEach<ExtraContext = object>(
  fn: SuiteHooks<ExtraContext>['beforeEach'][0],
  timeout?: number,
): void {
  return getCurrentSuite<ExtraContext>().on(
    'beforeEach',
    withTimeout(withFixtures(fn), timeout ?? getDefaultHookTimeout(), true),
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
 *
 * @example
 * // Example of using afterEach to delete temporary files created during a test
 * afterEach(async () => {
 *   await fileSystem.deleteTempFiles();
 * });
 */
export function afterEach<ExtraContext = object>(
  fn: SuiteHooks<ExtraContext>['afterEach'][0],
  timeout?: number,
): void {
  return getCurrentSuite<ExtraContext>().on(
    'afterEach',
    withTimeout(withFixtures(fn), timeout ?? getDefaultHookTimeout(), true),
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
 *
 * @example
 * // Example of using onTestFailed to log failure details
 * onTestFailed(({ errors }) => {
 *   console.log(`Test failed: ${test.name}`, errors);
 * });
 */
export const onTestFailed = createTestHook<OnTestFailedHandler>(
  'onTestFailed',
  (test, handler) => {
    test.onFailed ||= []
    test.onFailed.push(handler)
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
 * @param {Function} fn - The callback function to be executed after a test finishes. The function can receive parameters providing details about the completed test, including its success or failure status.
 * @param {number} [timeout] - Optional timeout in milliseconds for the hook. If not provided, the default hook timeout from the runner's configuration is used.
 * @throws {Error} Throws an error if the function is not called within a test.
 * @returns {void}
 *
 * @example
 * // Example of using onTestFinished for cleanup after each test
 * const db = await connectToDatabase();
 * onTestFinished(async () => {
 *   await db.disconnect();
 * });
 */
export const onTestFinished = createTestHook<OnTestFinishedHandler>(
  'onTestFinished',
  (test, handler) => {
    test.onFinished ||= []
    test.onFinished.push(handler)
  },
)

function createTestHook<T>(
  name: string,
  handler: (test: TaskPopulated, handler: T) => void,
) {
  return (fn: T) => {
    const current = getCurrentTest()

    if (!current) {
      throw new Error(`Hook ${name}() can only be called inside a test`)
    }

    return handler(current, fn)
  }
}
