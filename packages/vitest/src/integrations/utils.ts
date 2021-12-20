/* eslint-disable @typescript-eslint/no-unused-vars */

import { FakeTimers } from './timers'
import type { MaybeMocked, MaybeMockedDeep } from './jest-mock'
import { fn, spies, spyOn } from './jest-mock'

class VitestUtils {
  private _timers: FakeTimers

  constructor() {
    this._timers = new FakeTimers()
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

  public runAllTicks() {
    return this._timers.runAllTicks()
  }

  public setSystemTime(time?: number | Date) {
    return this._timers.setSystemTime(time)
  }

  public getRealSystemTime() {
    return this._timers.getRealSystemTime()
  }

  public getTimerCount() {
    return this._timers.getTimerCount()
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
