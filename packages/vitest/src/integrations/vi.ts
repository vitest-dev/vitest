import type { FakeTimerInstallOpts } from '@sinonjs/fake-timers'
import type { RuntimeOptions, SerializedConfig } from '../runtime/config'
import type { VitestMocker } from '../runtime/mocker'
import type { MockFactoryWithHelper, MockOptions } from '../types/mocker'
import type {
  MaybeMocked,
  MaybeMockedDeep,
  MaybePartiallyMocked,
  MaybePartiallyMockedDeep,
  MockInstance,
} from './spy'
import { assertTypes, createSimpleStackTrace } from '@vitest/utils'
import { getWorkerState, isChildProcess, resetModules, waitForImportsToResolve } from '../runtime/utils'
import { parseSingleStack } from '../utils/source-map'
import { FakeTimers } from './mock/timers'
import { fn, isMockFunction, mocks, spyOn } from './spy'
import { waitFor, waitUntil } from './wait'

type ESModuleExports = Record<string, unknown>

export interface VitestUtils {
  /**
   * Checks if fake timers are enabled.
   */
  isFakeTimers: () => boolean
  /**
   * This method wraps all further calls to timers until [`vi.useRealTimers()`](https://vitest.dev/api/vi#vi-userealtimers) is called.
   */
  useFakeTimers: (config?: FakeTimerInstallOpts) => VitestUtils
  /**
   * Restores mocked timers to their original implementations. All timers that were scheduled before will be discarded.
   */
  useRealTimers: () => VitestUtils
  /**
   * This method will call every timer that was initiated after [`vi.useFakeTimers`](https://vitest.dev/api/vi#vi-usefaketimers) call.
   * It will not fire any timer that was initiated during its call.
   */
  runOnlyPendingTimers: () => VitestUtils
  /**
   * This method will asynchronously call every timer that was initiated after [`vi.useFakeTimers`](https://vitest.dev/api/vi#vi-usefaketimers) call, even asynchronous ones.
   * It will not fire any timer that was initiated during its call.
   */
  runOnlyPendingTimersAsync: () => Promise<VitestUtils>
  /**
   * This method will invoke every initiated timer until the timer queue is empty. It means that every timer called during `runAllTimers` will be fired.
   * If you have an infinite interval, it will throw after 10,000 tries (can be configured with [`fakeTimers.loopLimit`](https://vitest.dev/config/#faketimers-looplimit)).
   */
  runAllTimers: () => VitestUtils
  /**
   * This method will asynchronously invoke every initiated timer until the timer queue is empty. It means that every timer called during `runAllTimersAsync` will be fired even asynchronous timers.
   * If you have an infinite interval, it will throw after 10 000 tries (can be configured with [`fakeTimers.loopLimit`](https://vitest.dev/config/#faketimers-looplimit)).
   */
  runAllTimersAsync: () => Promise<VitestUtils>
  /**
   * Calls every microtask that was queued by `process.nextTick`. This will also run all microtasks scheduled by themselves.
   */
  runAllTicks: () => VitestUtils
  /**
   * This method will invoke every initiated timer until the specified number of milliseconds is passed or the queue is empty - whatever comes first.
   */
  advanceTimersByTime: (ms: number) => VitestUtils
  /**
   * This method will invoke every initiated timer until the specified number of milliseconds is passed or the queue is empty - whatever comes first. This will include and await asynchronously set timers.
   */
  advanceTimersByTimeAsync: (ms: number) => Promise<VitestUtils>
  /**
   * Will call next available timer. Useful to make assertions between each timer call. You can chain call it to manage timers by yourself.
   */
  advanceTimersToNextTimer: () => VitestUtils
  /**
   * Will call next available timer and wait until it's resolved if it was set asynchronously. Useful to make assertions between each timer call.
   */
  advanceTimersToNextTimerAsync: () => Promise<VitestUtils>
  /**
   * Similar to [`vi.advanceTimersByTime`](https://vitest.dev/api/vi#vi-advancetimersbytime), but will advance timers by the milliseconds needed to execute callbacks currently scheduled with `requestAnimationFrame`.
   */
  advanceTimersToNextFrame: () => VitestUtils
  /**
   * Get the number of waiting timers.
   */
  getTimerCount: () => number
  /**
   * If fake timers are enabled, this method simulates a user changing the system clock (will affect date related API like `hrtime`, `performance.now` or `new Date()`) - however, it will not fire any timers.
   * If fake timers are not enabled, this method will only mock `Date.*` and `new Date()` calls.
   */
  setSystemTime: (time: number | string | Date) => VitestUtils
  /**
   * Returns mocked current date that was set using `setSystemTime`. If date is not mocked the method will return `null`.
   */
  getMockedSystemTime: () => Date | null
  /**
   * When using `vi.useFakeTimers`, `Date.now` calls are mocked. If you need to get real time in milliseconds, you can call this function.
   */
  getRealSystemTime: () => number
  /**
   * Removes all timers that are scheduled to run. These timers will never run in the future.
   */
  clearAllTimers: () => VitestUtils

  /**
   * Creates a spy on a method or getter/setter of an object similar to [`vi.fn()`](https://vitest.dev/api/vi#vi-fn). It returns a [mock function](https://vitest.dev/api/mock).
   * @example
   * ```ts
   * const cart = {
   *   getApples: () => 42
   * }
   *
   * const spy = vi.spyOn(cart, 'getApples').mockReturnValue(10)
   *
   * expect(cart.getApples()).toBe(10)
   * expect(spy).toHaveBeenCalled()
   * expect(spy).toHaveReturnedWith(10)
   * ```
   */
  spyOn: typeof spyOn

  /**
   * Creates a spy on a function, though can be initiated without one. Every time a function is invoked, it stores its call arguments, returns, and instances. Also, you can manipulate its behavior with [methods](https://vitest.dev/api/mock).
   *
   * If no function is given, mock will return `undefined`, when invoked.
   * @example
   * ```ts
   * const getApples = vi.fn(() => 0)
   *
   * getApples()
   *
   * expect(getApples).toHaveBeenCalled()
   * expect(getApples).toHaveReturnedWith(0)
   *
   * getApples.mockReturnValueOnce(5)
   *
   * expect(getApples()).toBe(5)
   * expect(getApples).toHaveNthReturnedWith(2, 5)
   * ```
   */
  fn: typeof fn

  /**
   * Wait for the callback to execute successfully. If the callback throws an error or returns a rejected promise it will continue to wait until it succeeds or times out.
   *
   * This is very useful when you need to wait for some asynchronous action to complete, for example, when you start a server and need to wait for it to start.
   * @example
   * ```ts
   * const server = createServer()
   *
   * await vi.waitFor(
   *   () => {
   *     if (!server.isReady)
   *       throw new Error('Server not started')
   *
   *     console.log('Server started')
   *   }, {
   *     timeout: 500, // default is 1000
   *     interval: 20, // default is 50
   *   }
   * )
   * ```
   */
  waitFor: typeof waitFor

  /**
   * This is similar to [`vi.waitFor`](https://vitest.dev/api/vi#vi-waitfor), but if the callback throws any errors, execution is immediately interrupted and an error message is received.
   *
   * If the callback returns a falsy value, the next check will continue until a truthy value is returned. This is useful when you need to wait for something to exist before taking the next step.
   * @example
   * ```ts
   * const element = await vi.waitUntil(
   *   () => document.querySelector('.element'),
   *   {
   *     timeout: 500, // default is 1000
   *     interval: 20, // default is 50
   *   }
   * )
   *
   * // do something with the element
   * expect(element.querySelector('.element-child')).toBeTruthy()
   * ```
   */
  waitUntil: typeof waitUntil

  /**
   * Run the factory before imports are evaluated. You can return a value from the factory
   * to reuse it inside your [`vi.mock`](https://vitest.dev/api/vi#vi-mock) factory and tests.
   *
   * If used with [`vi.mock`](https://vitest.dev/api/vi#vi-mock), both will be hoisted in the order they are defined in.
   */
  hoisted: <T>(factory: () => T) => T

  /**
   * Mocks every import call to the module even if it was already statically imported.
   *
   * The call to `vi.mock` is hoisted to the top of the file, so you don't have access to variables declared in the global file scope
   * unless they are defined with [`vi.hoisted`](https://vitest.dev/api/vi#vi-hoisted) before this call.
   *
   * Mocking algorithm is described in [documentation](https://vitest.dev/guide/mocking#modules).
   * @param path Path to the module. Can be aliased, if your Vitest config supports it
   * @param factory Mocked module factory. The result of this function will be an exports object
   */
  // eslint-disable-next-line ts/method-signature-style
  mock(path: string, factory?: MockFactoryWithHelper | MockOptions): void
  // eslint-disable-next-line ts/method-signature-style
  mock<T>(module: Promise<T>, factory?: MockFactoryWithHelper<T> | MockOptions): void

  /**
   * Removes module from mocked registry. All calls to import will return the original module even if it was mocked before.
   *
   * This call is hoisted to the top of the file, so it will only unmock modules that were defined in `setupFiles`, for example.
   * @param path Path to the module. Can be aliased, if your Vitest config supports it
   */
  // eslint-disable-next-line ts/method-signature-style
  unmock(path: string): void
  // eslint-disable-next-line ts/method-signature-style
  unmock(module: Promise<unknown>): void

  /**
   * Mocks every subsequent [dynamic import](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import) call.
   *
   * Unlike [`vi.mock`](https://vitest.dev/api/vi#vi-mock), this method will not mock statically imported modules because it is not hoisted to the top of the file.
   *
   * Mocking algorithm is described in [documentation](https://vitest.dev/guide/mocking#modules).
   * @param path Path to the module. Can be aliased, if your Vitest config supports it
   * @param factory Mocked module factory. The result of this function will be an exports object
   */
  // eslint-disable-next-line ts/method-signature-style
  doMock(path: string, factory?: MockFactoryWithHelper | MockOptions): void
  // eslint-disable-next-line ts/method-signature-style
  doMock<T>(module: Promise<T>, factory?: MockFactoryWithHelper<T> | MockOptions): void
  /**
   * Removes module from mocked registry. All subsequent calls to import will return original module.
   *
   * Unlike [`vi.unmock`](https://vitest.dev/api/vi#vi-unmock), this method is not hoisted to the top of the file.
   * @param path Path to the module. Can be aliased, if your Vitest config supports it
   */
  // eslint-disable-next-line ts/method-signature-style
  doUnmock(path: string): void
  // eslint-disable-next-line ts/method-signature-style
  doUnmock(module: Promise<unknown>): void

  /**
   * Imports module, bypassing all checks if it should be mocked.
   * Can be useful if you want to mock module partially.
   * @example
   * ```ts
   * vi.mock('./example.js', async () => {
   *  const axios = await vi.importActual<typeof import('./example.js')>('./example.js')
   *
   *  return { ...axios, get: vi.fn() }
   * })
   * ```
   * @param path Path to the module. Can be aliased, if your config supports it
   */
  importActual: <T = ESModuleExports>(path: string) => Promise<T>

  /**
   * Imports a module with all of its properties and nested properties mocked.
   *
   * Mocking algorithm is described in [documentation](https://vitest.dev/guide/mocking#modules).
   * @example
   * ```ts
   * const example = await vi.importMock<typeof import('./example.js')>('./example.js')
   * example.calc.mockReturnValue(10)
   * expect(example.calc()).toBe(10)
   * ```
   * @param path Path to the module. Can be aliased, if your config supports it
   * @returns Fully mocked module
   */
  importMock: <T = ESModuleExports>(
    path: string
  ) => Promise<MaybeMockedDeep<T>>

  /**
   * Type helper for TypeScript. Just returns the object that was passed.
   *
   * When `partial` is `true` it will expect a `Partial<T>` as a return value. By default, this will only make TypeScript believe that
   * the first level values are mocked. You can pass down `{ deep: true }` as a second argument to tell TypeScript that the whole object is mocked, if it actually is.
   * @example
   * ```ts
   * import example from './example.js'
   * vi.mock('./example.js')
   *
   * test('1 + 1 equals 10' async () => {
   *  vi.mocked(example.calc).mockReturnValue(10)
   *  expect(example.calc(1, '+', 1)).toBe(10)
   * })
   * ```
   * @param item Anything that can be mocked
   * @param deep If the object is deeply mocked
   * @param options If the object is partially or deeply mocked
   */
  mocked: (<T>(item: T, deep?: false) => MaybeMocked<T>) &
    (<T>(item: T, deep: true) => MaybeMockedDeep<T>) &
    (<T>(
      item: T,
      options: { partial?: false; deep?: false }
    ) => MaybeMocked<T>) &
    (<T>(
      item: T,
      options: { partial?: false; deep: true }
    ) => MaybeMockedDeep<T>) &
    (<T>(
      item: T,
      options: { partial: true; deep?: false }
    ) => MaybePartiallyMocked<T>) &
    (<T>(
      item: T,
      options: { partial: true; deep: true }
    ) => MaybePartiallyMockedDeep<T>) &
    (<T>(item: T) => MaybeMocked<T>)

  /**
   * Checks that a given parameter is a mock function. If you are using TypeScript, it will also narrow down its type.
   */
  isMockFunction: (fn: any) => fn is MockInstance

  /**
   * Calls [`.mockClear()`](https://vitest.dev/api/mock#mockclear) on every mocked function.
   *
   * This will only empty `.mock` state, it will not affect mock implementations.
   *
   * This is useful if you need to clean up mocks between different assertions within a test.
   */
  clearAllMocks: () => VitestUtils

  /**
   * Calls [`.mockReset()`](https://vitest.dev/api/mock#mockreset) on every mocked function.
   *
   * This will empty `.mock` state, reset "once" implementations, and reset each mock's base implementation to its original.
   *
   * This is useful when you want to reset all mocks to their original states.
   */
  resetAllMocks: () => VitestUtils

  /**
   * Calls [`.mockRestore()`](https://vitest.dev/api/mock#mockrestore) on every mocked function.
   *
   * This will empty `.mock` state, restore all original mock implementations, and restore original descriptors of spied-on objects.
   *
   * This is useful for inter-test cleanup and/or removing mocks created by [`vi.spyOn(...)`](https://vitest.dev/api/vi#vi-spyon).
   */
  restoreAllMocks: () => VitestUtils

  /**
   * Makes value available on global namespace.
   * Useful, if you want to have global variables available, like `IntersectionObserver`.
   * You can return it back to original value with `vi.unstubAllGlobals`, or by enabling `unstubGlobals` config option.
   */
  stubGlobal: (name: string | symbol | number, value: unknown) => VitestUtils

  /**
   * Changes the value of `import.meta.env` and `process.env`.
   * You can return it back to original value with `vi.unstubAllEnvs`, or by enabling `unstubEnvs` config option.
   */
  stubEnv: <T extends string>(
    name: T,
    value: T extends 'PROD' | 'DEV' | 'SSR' ? boolean : string | undefined
  ) => VitestUtils

  /**
   * Reset the value to original value that was available before first `vi.stubGlobal` was called.
   */
  unstubAllGlobals: () => VitestUtils

  /**
   * Reset environmental variables to the ones that were available before first `vi.stubEnv` was called.
   */
  unstubAllEnvs: () => VitestUtils

  /**
   * Resets modules registry by clearing the cache of all modules. This allows modules to be reevaluated when reimported.
   * Top-level imports cannot be re-evaluated. Might be useful to isolate modules where local state conflicts between tests.
   *
   * This method does not reset mocks registry. To clear mocks registry, use [`vi.unmock`](https://vitest.dev/api/vi#vi-unmock) or [`vi.doUnmock`](https://vitest.dev/api/vi#vi-dounmock).
   */
  resetModules: () => VitestUtils

  /**
   * Wait for all imports to load. Useful, if you have a synchronous call that starts
   * importing a module that you cannot await otherwise.
   * Will also wait for new imports, started during the wait.
   */
  dynamicImportSettled: () => Promise<void>

  /**
   * Updates runtime config. You can only change values that are used when executing tests.
   */
  setConfig: (config: RuntimeOptions) => void

  /**
   * If config was changed with `vi.setConfig`, this will reset it to the original state.
   */
  resetConfig: () => void
}

function createVitest(): VitestUtils {
  let _mockedDate: Date | null = null
  let _config: null | SerializedConfig = null

  const workerState = getWorkerState()

  let _timers: FakeTimers

  const timers = () =>
    (_timers ||= new FakeTimers({
      global: globalThis,
      config: workerState.config.fakeTimers,
    }))

  const _stubsGlobal = new Map<
    string | symbol | number,
    PropertyDescriptor | undefined
  >()
  const _stubsEnv = new Map()

  const _envBooleans = ['PROD', 'DEV', 'SSR']

  const utils: VitestUtils = {
    useFakeTimers(config?: FakeTimerInstallOpts) {
      if (isChildProcess()) {
        if (
          config?.toFake?.includes('nextTick')
          || workerState.config?.fakeTimers?.toFake?.includes('nextTick')
        ) {
          throw new Error(
            'vi.useFakeTimers({ toFake: ["nextTick"] }) is not supported in node:child_process. Use --pool=threads if mocking nextTick is required.',
          )
        }
      }

      if (config) {
        timers().configure({ ...workerState.config.fakeTimers, ...config })
      }
      else {
        timers().configure(workerState.config.fakeTimers)
      }

      timers().useFakeTimers()
      return utils
    },

    isFakeTimers() {
      return timers().isFakeTimers()
    },

    useRealTimers() {
      timers().useRealTimers()
      _mockedDate = null
      return utils
    },

    runOnlyPendingTimers() {
      timers().runOnlyPendingTimers()
      return utils
    },

    async runOnlyPendingTimersAsync() {
      await timers().runOnlyPendingTimersAsync()
      return utils
    },

    runAllTimers() {
      timers().runAllTimers()
      return utils
    },

    async runAllTimersAsync() {
      await timers().runAllTimersAsync()
      return utils
    },

    runAllTicks() {
      timers().runAllTicks()
      return utils
    },

    advanceTimersByTime(ms: number) {
      timers().advanceTimersByTime(ms)
      return utils
    },

    async advanceTimersByTimeAsync(ms: number) {
      await timers().advanceTimersByTimeAsync(ms)
      return utils
    },

    advanceTimersToNextTimer() {
      timers().advanceTimersToNextTimer()
      return utils
    },

    async advanceTimersToNextTimerAsync() {
      await timers().advanceTimersToNextTimerAsync()
      return utils
    },

    advanceTimersToNextFrame() {
      timers().advanceTimersToNextFrame()
      return utils
    },

    getTimerCount() {
      return timers().getTimerCount()
    },

    setSystemTime(time: number | string | Date) {
      const date = time instanceof Date ? time : new Date(time)
      _mockedDate = date
      timers().setSystemTime(date)
      return utils
    },

    getMockedSystemTime() {
      return _mockedDate
    },

    getRealSystemTime() {
      return timers().getRealSystemTime()
    },

    clearAllTimers() {
      timers().clearAllTimers()
      return utils
    },

    // mocks

    spyOn,
    fn,
    waitFor,
    waitUntil,
    hoisted<T>(factory: () => T): T {
      assertTypes(factory, '"vi.hoisted" factory', ['function'])
      return factory()
    },

    mock(path: string | Promise<unknown>, factory?: MockOptions | MockFactoryWithHelper) {
      if (typeof path !== 'string') {
        throw new TypeError(
          `vi.mock() expects a string path, but received a ${typeof path}`,
        )
      }
      const importer = getImporter('mock')
      _mocker().queueMock(
        path,
        importer,
        typeof factory === 'function'
          ? () =>
              factory(() =>
                _mocker().importActual(
                  path,
                  importer,
                  _mocker().getMockContext().callstack,
                ),
              )
          : factory,
      )
    },

    unmock(path: string | Promise<unknown>) {
      if (typeof path !== 'string') {
        throw new TypeError(
          `vi.unmock() expects a string path, but received a ${typeof path}`,
        )
      }
      _mocker().queueUnmock(path, getImporter('unmock'))
    },

    doMock(path: string | Promise<unknown>, factory?: MockOptions | MockFactoryWithHelper) {
      if (typeof path !== 'string') {
        throw new TypeError(
          `vi.doMock() expects a string path, but received a ${typeof path}`,
        )
      }
      const importer = getImporter('doMock')
      _mocker().queueMock(
        path,
        importer,
        typeof factory === 'function'
          ? () =>
              factory(() =>
                _mocker().importActual(
                  path,
                  importer,
                  _mocker().getMockContext().callstack,
                ),
              )
          : factory,
      )
    },

    doUnmock(path: string | Promise<unknown>) {
      if (typeof path !== 'string') {
        throw new TypeError(
          `vi.doUnmock() expects a string path, but received a ${typeof path}`,
        )
      }
      _mocker().queueUnmock(path, getImporter('doUnmock'))
    },

    async importActual<T = unknown>(path: string): Promise<T> {
      return _mocker().importActual<T>(
        path,
        getImporter('importActual'),
        _mocker().getMockContext().callstack,
      )
    },

    async importMock<T>(path: string): Promise<MaybeMockedDeep<T>> {
      return _mocker().importMock(path, getImporter('importMock'))
    },

    // this is typed in the interface so it's not necessary to type it here
    mocked<T>(item: T, _options = {}): any {
      return item
    },

    isMockFunction(fn: any): fn is MockInstance {
      return isMockFunction(fn)
    },

    clearAllMocks() {
      mocks.forEach(spy => spy.mockClear())
      return utils
    },

    resetAllMocks() {
      mocks.forEach(spy => spy.mockReset())
      return utils
    },

    restoreAllMocks() {
      mocks.forEach(spy => spy.mockRestore())
      return utils
    },

    stubGlobal(name: string | symbol | number, value: any) {
      if (!_stubsGlobal.has(name)) {
        _stubsGlobal.set(
          name,
          Object.getOwnPropertyDescriptor(globalThis, name),
        )
      }
      Object.defineProperty(globalThis, name, {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      })
      return utils
    },

    stubEnv(name: string, value: string | boolean | undefined) {
      if (!_stubsEnv.has(name)) {
        _stubsEnv.set(name, process.env[name])
      }
      if (_envBooleans.includes(name)) {
        process.env[name] = value ? '1' : ''
      }
      else if (value === undefined) {
        delete process.env[name]
      }
      else {
        process.env[name] = String(value)
      }
      return utils
    },

    unstubAllGlobals() {
      _stubsGlobal.forEach((original, name) => {
        if (!original) {
          Reflect.deleteProperty(globalThis, name)
        }
        else {
          Object.defineProperty(globalThis, name, original)
        }
      })
      _stubsGlobal.clear()
      return utils
    },

    unstubAllEnvs() {
      _stubsEnv.forEach((original, name) => {
        if (original === undefined) {
          delete process.env[name]
        }
        else {
          process.env[name] = original
        }
      })
      _stubsEnv.clear()
      return utils
    },

    resetModules() {
      resetModules(workerState.moduleCache)
      return utils
    },

    async dynamicImportSettled() {
      return waitForImportsToResolve()
    },

    setConfig(config: RuntimeOptions) {
      if (!_config) {
        _config = { ...workerState.config }
      }
      Object.assign(workerState.config, config)
    },

    resetConfig() {
      if (_config) {
        Object.assign(workerState.config, _config)
      }
    },
  }

  return utils
}

export const vitest = createVitest()
export const vi = vitest

function _mocker(): VitestMocker {
  // @ts-expect-error injected by vite-nide
  return typeof __vitest_mocker__ !== 'undefined'
  // @ts-expect-error injected by vite-nide
    ? __vitest_mocker__
    : new Proxy(
      {},
      {
        get(_, name) {
          throw new Error(
            'Vitest mocker was not initialized in this environment. '
            + `vi.${String(name)}() is forbidden.`,
          )
        },
      },
    )
}

function getImporter(name: string) {
  const stackTrace = createSimpleStackTrace({ stackTraceLimit: 5 })
  const stackArray = stackTrace.split('\n')
  // if there is no message in a stack trace, use the item - 1
  const importerStackIndex = stackArray.findIndex((stack) => {
    return stack.includes(` at Object.${name}`) || stack.includes(`${name}@`)
  })
  const stack = parseSingleStack(stackArray[importerStackIndex + 1])
  return stack?.file || ''
}
