import type { FakeTimerInstallOpts } from '@sinonjs/fake-timers'
import { parseStacktrace } from '../utils/source-map'
import type { VitestMocker } from '../runtime/mocker'
import type { ResolvedConfig, RuntimeConfig } from '../types'
import { getWorkerState, resetModules, setTimeout } from '../utils'
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
      + '\n\nOne of the following is possible:'
      + '\n- "vitest" is imported outside of your tests (in that case, use "vitest/node" or import.meta.vitest)'
      + '\n- "vitest" is imported inside "globalSetup" (use "setupFiles", because "globalSetup" runs in a different context)'
      + '\n- Your dependency inside "node_modules" imports "vitest" directly (in that case, inline that dependency, using "deps.inline" config)'
      + '\n- Otherwise, it might be a Vitest bug. Please report it to https://github.com/vitest-dev/vitest/issues\n'
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

  public runAllTimers() {
    this._timers.runAllTimers()
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

  public advanceTimersToNextTimer() {
    this._timers.advanceTimersToNextTimer()
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
    const err = new Error('mock')
    const [,, importer] = parseStacktrace(err, true)
    return importer.file
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
  public mock(path: string, factory?: () => any) {
    this._mocker.queueMock(path, this.getImporter(), factory)
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
  public async importActual<T>(path: string): Promise<T> {
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

  /**
   * Will put a value on global scope. Useful, if you are
   * using jsdom/happy-dom and want to mock global variables, like
   * `IntersectionObserver`.
   */
  public stubGlobal(name: string | symbol | number, value: any) {
    if (globalThis.window) {
      // @ts-expect-error we can do anything!
      globalThis.window[name] = value
    }
    else {
      // @ts-expect-error we can do anything!
      globalThis[name] = value
    }

    return this
  }

  public resetModules() {
    const state = getWorkerState()
    resetModules(state.moduleCache)
    return this
  }

  /**
   * Wait for all imports to load.
   * Useful, if you have a synchronous call that starts
   * importing a module, that you cannot wait otherwise.
   */
  public async dynamicImportSettled() {
    const state = getWorkerState()
    const promises: Promise<unknown>[] = []
    for (const mod of state.moduleCache.values()) {
      if (mod.promise)
        promises.push(mod.promise)
    }
    await Promise.allSettled(promises)
    // wait until the end of the loop, so `.then` on modules called,
    // like in import('./example').then(...)
    await new Promise(resolve => setTimeout(resolve, 1)).then(() => Promise.resolve())
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
      state.config = { ...this._config }
    }
  }
}

export const vitest = new VitestUtils()
export const vi = vitest
