/* eslint-disable @typescript-eslint/no-unused-vars */

import mockdate from 'mockdate'
import { FakeTimers } from './timers'
import type { MaybeMocked, MaybeMockedDeep } from './jest-mock'
import { fn, spies, spyOn } from './jest-mock'

class VitestUtils {
  private _timers: FakeTimers
  private _mockedDate: string | number | Date | null

  constructor() {
    this._timers = new FakeTimers()
    this._mockedDate = null
  }

  // timers

  public useFakeTimers() {
    return this._timers.useFakeTimers()
  }

  public useRealTimers() {
    return this._timers.useRealTimers()
  }

  public runOnlyPendingTimers() {
    return this._timers.runOnlyPendingTimers()
  }

  public runAllTimers() {
    return this._timers.runAllTimers()
  }

  public advanceTimersByTime(ms: number) {
    return this._timers.advanceTimersByTime(ms)
  }

  public advanceTimersToNextTimer() {
    return this._timers.advanceTimersToNextTimer()
  }

  public getTimerCount() {
    return this._timers.getTimerCount()
  }

  // date

  public mockCurrentDate(date: string | number | Date) {
    this._mockedDate = date
    mockdate.set(date)
  }

  public restoreCurrentDate() {
    this._mockedDate = null
    mockdate.reset()
  }

  public getMockedDate() {
    return this._mockedDate
  }

  // mocks

  spyOn = spyOn
  fn = fn

  // just hints for transformer to rewrite imports
  public mock(path: string) {}
  public unmock(path: string) {}

  public async importActual<T>(path: string): Promise<T> {
    return {} as T
  }

  public async importMock<T>(path: string): Promise<T> {
    return {} as T
  }

  // the typings test helper
  public mocked<T>(item: T, deep?: false): MaybeMocked<T>;
  public mocked<T>(item: T, deep: true): MaybeMockedDeep<T>;
  public mocked<T>(item: T, _deep = false): MaybeMocked<T> | MaybeMockedDeep<T> {
    return item as any
  }

  public isMockFunction(fn: any) {
    return typeof fn === 'function'
      && '__isSpy' in fn
      && fn.__isSpy
  }

  public clearAllMocks() {
    // @ts-expect-error clearing module mocks
    __vitest__clearMocks__({ clearMocks: true })
    spies.forEach(spy => spy.mockClear())
    return this
  }

  public resetAllMocks() {
    // @ts-expect-error reseting module mocks
    __vitest__clearMocks__({ mockReset: true })
    spies.forEach(spy => spy.mockReset())
    return this
  }

  public restoreAllMocks() {
    // @ts-expect-error restoring module mocks
    __vitest__clearMocks__({ restoreMocks: true })
    spies.forEach(spy => spy.mockRestore())
    return this
  }
}

export const vitest = new VitestUtils()
export const vi = vitest
