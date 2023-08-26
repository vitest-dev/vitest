import type { FakeTimerInstallOpts } from '@sinonjs/fake-timers'
import { assertTypes, createSimpleStackTrace } from '@vitest/utils'
import { parseSingleStack } from '../utils/source-map'
import type { VitestMocker } from '../runtime/mocker'
import type { ResolvedConfig, RuntimeConfig } from '../types'
import type { MockFactoryWithHelper } from '../types/mocker'
import { getWorkerState } from '../utils/global'
import { resetModules, waitForImportsToResolve } from '../utils/modules'
import { FakeTimers } from './mock/timers'
import type { EnhancedSpy, MaybeMocked, MaybeMockedDeep, MaybePartiallyMocked, MaybePartiallyMockedDeep } from './spy'
import { fn, isMockFunction, spies, spyOn } from './spy'

interface VitestUtils {
  useFakeTimers(config?: FakeTimerInstallOpts): this
  useRealTimers(): this
  runOnlyPendingTimers(): this
  runOnlyPendingTimersAsync(): Promise<this>
  runAllTimers(): this
  runAllTimersAsync(): Promise<this>
  runAllTicks(): this
  advanceTimersByTime(ms: number): this
  advanceTimersByTimeAsync(ms: number): Promise<this>
  advanceTimersToNextTimer(): this
  advanceTimersToNextTimerAsync(): Promise<this>
  getTimerCount(): number
  setSystemTime(time: number | string | Date): this
  getMockedSystemTime(): Date | null
  getRealSystemTime(): number
  clearAllTimers(): this

  spyOn: typeof spyOn
  fn: typeof fn

  /**
   * Run the factory before imports are evaluated. You can return a value from the factory
   * to reuse it inside your `vi.mock` factory and tests.
   */
  hoisted<T>(factory: () => T): T

  /**
   * Makes all `imports` to passed module to be mocked.
   * - If there is a factory, will return it's result. The call to `vi.mock` is hoisted to the top of the file,
   * so you don't have access to variables declared in the global file scope, if you didn't put them before imports!
   * - If `__mocks__` folder with file of the same name exist, all imports will
   * return it.
   * - If there is no `__mocks__` folder or a file with the same name inside, will call original
   * module and mock it.
   * @param path Path to the module. Can be aliased, if your config supports it
   * @param factory Factory for the mocked module. Has the highest priority.
   */
  mock(path: string, factory?: MockFactoryWithHelper): void

  /**
   * Removes module from mocked registry. All subsequent calls to import will
   * return original module even if it was mocked.
   * @param path Path to the module. Can be aliased, if your config supports it
   */
  unmock(path: string): void

  doMock(path: string, factory?: () => any): void
  doUnmock(path: string): void

  /**
   * Imports module, bypassing all checks if it should be mocked.
   * Can be useful if you want to mock module partially.
   * @example
   * vi.mock('./example', async () => {
   *  const axios = await vi.importActual('./example')
   *
   *  return { ...axios, get: vi.fn() }
   * })
   * @param path Path to the module. Can be aliased, if your config supports it
   * @returns Actual module without spies
   */
  importActual<T = unknown>(path: string): Promise<T>

  /**
   * Imports a module with all of its properties and nested properties mocked.
   * For the rules applied, see docs.
   * @param path Path to the module. Can be aliased, if your config supports it
   * @returns Fully mocked module
   */
  importMock<T>(path: string): Promise<MaybeMockedDeep<T>>

  /**
   * Type helpers for TypeScript. In reality just returns the object that was passed.
   *
   * When `partial` is `true` it will expect a `Partial<T>` as a return value.
   * @example
   * import example from './example'
   * vi.mock('./example')
   *
   * test('1+1 equals 2' async () => {
   *  vi.mocked(example.calc).mockRestore()
   *
   *  const res = example.calc(1, '+', 1)
   *
   *  expect(res).toBe(2)
   * })
   * @param item Anything that can be mocked
   * @param deep If the object is deeply mocked
   * @param options If the object is partially or deeply mocked
   */
  mocked<T>(item: T, deep?: false): MaybeMocked<T>
  mocked<T>(item: T, deep: true): MaybeMockedDeep<T>
  mocked<T>(item: T, options: { partial?: false; deep?: false }): MaybeMocked<T>
  mocked<T>(item: T, options: { partial?: false; deep: true }): MaybeMockedDeep<T>
  mocked<T>(item: T, options: { partial: true; deep?: false }): MaybePartiallyMocked<T>
  mocked<T>(item: T, options: { partial: true; deep: true }): MaybePartiallyMockedDeep<T>
  mocked<T>(item: T): MaybeMocked<T>

  isMockFunction(fn: any): fn is EnhancedSpy

  clearAllMocks(): this
  resetAllMocks(): this
  restoreAllMocks(): this

  /**
   * Makes value available on global namespace.
   * Useful, if you want to have global variables available, like `IntersectionObserver`.
   * You can return it back to original value with `vi.unstubAllGlobals`, or by enabling `unstubGlobals` config option.
   */
  stubGlobal(name: string | symbol | number, value: unknown): this

  /**
   * Changes the value of `import.meta.env` and `process.env`.
   * You can return it back to original value with `vi.unstubAllEnvs`, or by enabling `unstubEnvs` config option.
   */
  stubEnv(name: string, value: string): this

  /**
   * Reset the value to original value that was available before first `vi.stubGlobal` was called.
   */
  unstubAllGlobals(): this

  /**
   * Reset environmental variables to the ones that were available before first `vi.stubEnv` was called.
   */
  unstubAllEnvs(): this

  resetModules(): this

  /**
   * Wait for all imports to load. Useful, if you have a synchronous call that starts
   * importing a module that you cannot await otherwise.
   * Will also wait for new imports, started during the wait.
   */
  dynamicImportSettled(): Promise<void>

  /**
   * Updates runtime config. You can only change values that are used when executing tests.
   */
  setConfig(config: RuntimeConfig): void

  /**
   * If config was changed with `vi.setConfig`, this will reset it to the original state.
   */
  resetConfig(): void
}

function createVitest(): VitestUtils {
  // @ts-expect-error injected by vite-nide
  const _mocker: VitestMocker = typeof __vitest_mocker__ !== 'undefined'
    // @ts-expect-error injected by vite-nide
    ? __vitest_mocker__
    : new Proxy({}, {
      get(_, name) {
        throw new Error(
          'Vitest mocker was not initialized in this environment. '
          + `vi.${String(name)}() is forbidden.`,
        )
      },
    })
  let _mockedDate: Date | null = null
  let _config: null | ResolvedConfig = null

  const workerState = getWorkerState()

  if (!workerState) {
    const errorMsg = 'Vitest failed to access its internal state.'
      + '\n\nOne of the following is possible:'
      + '\n- "vitest" is imported directly without running "vitest" command'
      + '\n- "vitest" is imported inside "globalSetup" (to fix this, use "setupFiles" instead, because "globalSetup" runs in a different context)'
      + '\n- Otherwise, it might be a Vitest bug. Please report it to https://github.com/vitest-dev/vitest/issues\n'
    throw new Error(errorMsg)
  }

  const _timers = new FakeTimers({
    global: globalThis,
    config: workerState.config.fakeTimers,
  })

  const _stubsGlobal = new Map<string | symbol | number, PropertyDescriptor | undefined>()
  const _stubsEnv = new Map()

  const getImporter = () => {
    const stackTrace = createSimpleStackTrace({ stackTraceLimit: 4 })
    const importerStack = stackTrace.split('\n')[4]
    const stack = parseSingleStack(importerStack)
    return stack?.file || ''
  }

  return {
    useFakeTimers(config?: FakeTimerInstallOpts) {
      if (config) {
        _timers.configure(config)
      }
      else {
        const workerState = getWorkerState()
        _timers.configure(workerState.config.fakeTimers)
      }
      _timers.useFakeTimers()
      return this
    },

    useRealTimers() {
      _timers.useRealTimers()
      _mockedDate = null
      return this
    },

    runOnlyPendingTimers() {
      _timers.runOnlyPendingTimers()
      return this
    },

    async runOnlyPendingTimersAsync() {
      await _timers.runOnlyPendingTimersAsync()
      return this
    },

    runAllTimers() {
      _timers.runAllTimers()
      return this
    },

    async runAllTimersAsync() {
      await _timers.runAllTimersAsync()
      return this
    },

    runAllTicks() {
      _timers.runAllTicks()
      return this
    },

    advanceTimersByTime(ms: number) {
      _timers.advanceTimersByTime(ms)
      return this
    },

    async advanceTimersByTimeAsync(ms: number) {
      await _timers.advanceTimersByTimeAsync(ms)
      return this
    },

    advanceTimersToNextTimer() {
      _timers.advanceTimersToNextTimer()
      return this
    },

    async advanceTimersToNextTimerAsync() {
      await _timers.advanceTimersToNextTimerAsync()
      return this
    },

    getTimerCount() {
      return _timers.getTimerCount()
    },

    setSystemTime(time: number | string | Date) {
      const date = time instanceof Date ? time : new Date(time)
      _mockedDate = date
      _timers.setSystemTime(date)
      return this
    },

    getMockedSystemTime() {
      return _mockedDate
    },

    getRealSystemTime() {
      return _timers.getRealSystemTime()
    },

    clearAllTimers() {
      _timers.clearAllTimers()
      return this
    },

    // mocks

    spyOn,
    fn,

    hoisted<T>(factory: () => T): T {
      assertTypes(factory, '"vi.hoisted" factory', ['function'])
      return factory()
    },

    mock(path: string, factory?: MockFactoryWithHelper) {
      const importer = getImporter()
      _mocker.queueMock(
        path,
        importer,
        factory ? () => factory(() => _mocker.importActual(path, importer)) : undefined,
      )
    },

    unmock(path: string) {
      _mocker.queueUnmock(path, getImporter())
    },

    doMock(path: string, factory?: () => any) {
      _mocker.queueMock(path, getImporter(), factory)
    },

    doUnmock(path: string) {
      _mocker.queueUnmock(path, getImporter())
    },

    async importActual<T = unknown>(path: string): Promise<T> {
      return _mocker.importActual<T>(path, getImporter())
    },

    async importMock<T>(path: string): Promise<MaybeMockedDeep<T>> {
      return _mocker.importMock(path, getImporter())
    },

    mocked<T>(item: T, _options = {}): MaybeMocked<T> {
      return item as any
    },

    isMockFunction(fn: any): fn is EnhancedSpy {
      return isMockFunction(fn)
    },

    clearAllMocks() {
      spies.forEach(spy => spy.mockClear())
      return this
    },

    resetAllMocks() {
      spies.forEach(spy => spy.mockReset())
      return this
    },

    restoreAllMocks() {
      spies.forEach(spy => spy.mockRestore())
      return this
    },

    stubGlobal(name: string | symbol | number, value: any) {
      if (!_stubsGlobal.has(name))
        _stubsGlobal.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
      Object.defineProperty(globalThis, name, {
        value,
        writable: true,
        configurable: true,
        enumerable: true,
      })
      return this
    },

    stubEnv(name: string, value: string) {
      if (!_stubsEnv.has(name))
        _stubsEnv.set(name, process.env[name])
      process.env[name] = value
      return this
    },

    unstubAllGlobals() {
      _stubsGlobal.forEach((original, name) => {
        if (!original)
          Reflect.deleteProperty(globalThis, name)
        else
          Object.defineProperty(globalThis, name, original)
      })
      _stubsGlobal.clear()
      return this
    },

    unstubAllEnvs() {
      _stubsEnv.forEach((original, name) => {
        if (original === undefined)
          delete process.env[name]
        else
          process.env[name] = original
      })
      _stubsEnv.clear()
      return this
    },

    resetModules() {
      const state = getWorkerState()
      resetModules(state.moduleCache)
      return this
    },

    async dynamicImportSettled() {
      return waitForImportsToResolve()
    },

    setConfig(config: RuntimeConfig) {
      const state = getWorkerState()
      if (!_config)
        _config = { ...state.config }
      Object.assign(state.config, config)
    },

    resetConfig() {
      if (_config) {
        const state = getWorkerState()
        Object.assign(state.config, _config)
      }
    },

  }
}

export const vitest = createVitest()
export const vi = vitest
