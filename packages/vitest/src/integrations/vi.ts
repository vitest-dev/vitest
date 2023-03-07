import type { FakeTimerInstallOpts } from '@sinonjs/fake-timers'
import { createSimpleStackTrace } from '@vitest/utils'
import { parseSingleStack } from '../utils/source-map'
import type { VitestMocker } from '../runtime/mocker'
import type { ResolvedConfig, RuntimeConfig } from '../types'
import { getWorkerState, resetModules, waitForImportsToResolve } from '../utils'
import type { MockFactoryWithHelper } from '../types/mocker'
import { FakeTimers } from './mock/timers'
import type { EnhancedSpy, MaybeMocked, MaybeMockedDeep, MaybePartiallyMocked, MaybePartiallyMockedDeep } from './spy'
import { fn, isMockFunction, spies, spyOn } from './spy'

class VitestUtils {
  private _timers: FakeTimers
  private _mockedDate: string | number | Date | null
  private _mocker: VitestMocker

  constructor() {
    // @ts-expect-error injected by vite-nide
    this._mocker = typeof __vitest_mocker__ !== 'undefined' ? __vitest_mocker__ : null
    this._mockedDate = null

    if (!this._mocker) {
      const errorMsg = 'Vitest was initialized with native Node instead of Vite Node.'
      + '\n\nIt\'s possible that you are importing "vitest" directly inside "globalSetup". In that case, use "setupFiles" because "globalSetup" runs in a different context.'
      + '\nOtherwise, it might be a Vitest bug. Please report it to https://github.com/vitest-dev/vitest/issues\n'
      throw new Error(errorMsg)
    }

    const workerState = getWorkerState()
    this._timers = new FakeTimers({
      global: globalThis,
      config: workerState.config.fakeTimers,
    })
  }

  // timers

  public useFakeTimers(config?: FakeTimerInstallOpts) {
    if (config) {
      this._timers.configure(config)
    }
    else {
      const workerState = getWorkerState()
      this._timers.configure(workerState.config.fakeTimers)
    }
    this._timers.useFakeTimers()
    return this
  }

  public useRealTimers() {
    this._timers.useRealTimers()
    this._mockedDate = null
    return this
  }

  public runOnlyPendingTimers() {
    this._timers.runOnlyPendingTimers()
    return this
  }

  public async runOnlyPendingTimersAsync() {
    await this._timers.runOnlyPendingTimersAsync()
    return this
  }

  public runAllTimers() {
    this._timers.runAllTimers()
    return this
  }

  public async runAllTimersAsync() {
    await this._timers.runAllTimersAsync()
    return this
  }

  public runAllTicks() {
    this._timers.runAllTicks()
    return this
  }

  public advanceTimersByTime(ms: number) {
    this._timers.advanceTimersByTime(ms)
    return this
  }

  public async advanceTimersByTimeAsync(ms: number) {
    await this._timers.advanceTimersByTimeAsync(ms)
    return this
  }

  public advanceTimersToNextTimer() {
    this._timers.advanceTimersToNextTimer()
    return this
  }

  public async advanceTimersToNextTimerAsync() {
    await this._timers.advanceTimersToNextTimerAsync()
    return this
  }

  public getTimerCount() {
    return this._timers.getTimerCount()
  }

  public setSystemTime(time: number | string | Date) {
    const date = time instanceof Date ? time : new Date(time)
    this._mockedDate = date
    this._timers.setSystemTime(date)
    return this
  }

  public getMockedSystemTime() {
    return this._mockedDate
  }

  public getRealSystemTime() {
    return this._timers.getRealSystemTime()
  }

  public clearAllTimers() {
    this._timers.clearAllTimers()
    return this
  }

  // mocks

  spyOn = spyOn
  fn = fn

  private getImporter() {
    const stackTrace = createSimpleStackTrace({ stackTraceLimit: 4 })
    const importerStack = stackTrace.split('\n')[4]
    const stack = parseSingleStack(importerStack)
    return stack?.file || ''
  }

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
  public mock(path: string, factory?: MockFactoryWithHelper) {
    const importer = this.getImporter()
    this._mocker.queueMock(
      path,
      importer,
      factory ? () => factory(() => this._mocker.importActual(path, importer)) : undefined,
    )
  }

  /**
   * Removes module from mocked registry. All subsequent calls to import will
   * return original module even if it was mocked.
   * @param path Path to the module. Can be aliased, if your config supports it
   */
  public unmock(path: string) {
    this._mocker.queueUnmock(path, this.getImporter())
  }

  public doMock(path: string, factory?: () => any) {
    this._mocker.queueMock(path, this.getImporter(), factory)
  }

  public doUnmock(path: string) {
    this._mocker.queueUnmock(path, this.getImporter())
  }

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
  public async importActual<T = unknown>(path: string): Promise<T> {
    return this._mocker.importActual<T>(path, this.getImporter())
  }

  /**
   * Imports a module with all of its properties and nested properties mocked.
   * For the rules applied, see docs.
   * @param path Path to the module. Can be aliased, if your config supports it
   * @returns Fully mocked module
   */
  public async importMock<T>(path: string): Promise<MaybeMockedDeep<T>> {
    return this._mocker.importMock(path, this.getImporter())
  }

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
  public mocked<T>(item: T, deep?: false): MaybeMocked<T>
  public mocked<T>(item: T, deep: true): MaybeMockedDeep<T>
  public mocked<T>(item: T, options: { partial?: false; deep?: false }): MaybeMocked<T>
  public mocked<T>(item: T, options: { partial?: false; deep: true }): MaybeMockedDeep<T>
  public mocked<T>(item: T, options: { partial: true; deep?: false }): MaybePartiallyMocked<T>
  public mocked<T>(item: T, options: { partial: true; deep: true }): MaybePartiallyMockedDeep<T>
  public mocked<T>(item: T, _options = {}): MaybeMocked<T> {
    return item as any
  }

  public isMockFunction(fn: any): fn is EnhancedSpy {
    return isMockFunction(fn)
  }

  public clearAllMocks() {
    spies.forEach(spy => spy.mockClear())
    return this
  }

  public resetAllMocks() {
    spies.forEach(spy => spy.mockReset())
    return this
  }

  public restoreAllMocks() {
    spies.forEach(spy => spy.mockRestore())
    return this
  }

  private _stubsGlobal = new Map<string | symbol | number, PropertyDescriptor | undefined>()
  private _stubsEnv = new Map()

  /**
   * Makes value available on global namespace.
   * Useful, if you want to have global variables available, like `IntersectionObserver`.
   * You can return it back to original value with `vi.unstubGlobals`, or by enabling `unstubGlobals` config option.
   */
  public stubGlobal(name: string | symbol | number, value: any) {
    if (!this._stubsGlobal.has(name))
      this._stubsGlobal.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
    Object.defineProperty(globalThis, name, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    })
    return this
  }

  /**
   * Changes the value of `import.meta.env` and `process.env`.
   * You can return it back to original value with `vi.unstubEnvs`, or by enabling `unstubEnvs` config option.
   */
  public stubEnv(name: string, value: string) {
    if (!this._stubsEnv.has(name))
      this._stubsEnv.set(name, process.env[name])
    process.env[name] = value
    return this
  }

  /**
   * Reset the value to original value that was available before first `vi.stubGlobal` was called.
   */
  public unstubAllGlobals() {
    this._stubsGlobal.forEach((original, name) => {
      if (!original)
        Reflect.deleteProperty(globalThis, name)
      else
        Object.defineProperty(globalThis, name, original)
    })
    this._stubsGlobal.clear()
    return this
  }

  /**
   * Reset environmental variables to the ones that were available before first `vi.stubEnv` was called.
   */
  public unstubAllEnvs() {
    this._stubsEnv.forEach((original, name) => {
      if (original === undefined)
        delete process.env[name]
      else
        process.env[name] = original
    })
    this._stubsEnv.clear()
    return this
  }

  public resetModules() {
    const state = getWorkerState()
    resetModules(state.moduleCache)
    return this
  }

  /**
   * Wait for all imports to load. Useful, if you have a synchronous call that starts
   * importing a module that you cannot await otherwise.
   * Will also wait for new imports, started during the wait.
   */
  public async dynamicImportSettled() {
    return waitForImportsToResolve()
  }

  private _config: null | ResolvedConfig = null

  /**
   * Updates runtime config. You can only change values that are used when executing tests.
   */
  public setConfig(config: RuntimeConfig) {
    const state = getWorkerState()
    if (!this._config)
      this._config = { ...state.config }
    Object.assign(state.config, config)
  }

  /**
   * If config was changed with `vi.setConfig`, this will reset it to the original state.
   */
  public resetConfig() {
    if (this._config) {
      const state = getWorkerState()
      Object.assign(state.config, this._config)
    }
  }
}

export const vitest = new VitestUtils()
export const vi = vitest
