/* eslint-disable @typescript-eslint/no-unused-vars */

import { parseStacktrace } from '../utils/source-map'
import type { VitestMocker } from '../node/mocker'
import { FakeTimers } from './timers'
import type { EnhancedSpy, MaybeMocked, MaybeMockedDeep } from './jest-mock'
import { fn, isMockFunction, spies, spyOn } from './jest-mock'

class VitestUtils {
  private _timers: FakeTimers
  private _mockedDate: string | number | Date | null
  private _mocker: VitestMocker

  constructor() {
    this._timers = new FakeTimers({
      global: globalThis,
      maxLoops: 10_000,
    })
    // @ts-expect-error injected by vite-nide
    this._mocker = typeof __vitest_mocker__ !== 'undefined' ? __vitest_mocker__ : null
    this._mockedDate = null

    if (!this._mocker)
      throw new Error('Vitest was initialized with native Node instead of Vite Node')
  }

  // timers

  public useFakeTimers() {
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
   */
  public mocked<T>(item: T, deep?: false): MaybeMocked<T>
  public mocked<T>(item: T, deep: true): MaybeMockedDeep<T>
  public mocked<T>(item: T, _deep = false): MaybeMocked<T> | MaybeMockedDeep<T> {
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
}

export const vitest = new VitestUtils()
export const vi = vitest
