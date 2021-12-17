/* eslint-disable @typescript-eslint/no-unused-vars */

import { spies } from 'tinyspy'
import { FakeTimers } from './timers'
import type { MaybeMocked, MaybeMockedDeep } from './jest-mock'
import { spyOn, fn } from './jest-mock'

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
  public mock(path: string) {
    return {}
  }

  public unmock(path: string) {
    return {}
  }

  public async requireActual<T>(path: string): Promise<T> {
    return {} as T
  }

  public async requireMock<T>(path: string): Promise<T> {
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
    spies.forEach((spy) => {
      spy.reset()
    })
    return this
  }

  public resetAllMocks() {
    spies.forEach((spy) => {
      spy.reset()
    })
    return this
  }

  public restoreAllMocks() {
    spies.forEach((spy) => {
      spy.restore()
    })
    return this
  }
}

export const vitest = new VitestUtils()
export const vi = vitest
