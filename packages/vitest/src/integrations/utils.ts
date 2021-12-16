import { spies } from 'tinyspy'
import { FakeTimers } from './timers'
import { spyOn, fn } from './jest-mock'

class VitestUtils {
  spyOn = spyOn
  fn = fn
  mock = (path: string) => path

  private _timers: FakeTimers

  constructor() {
    this._timers = new FakeTimers()
  }

  // mocks

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

  public isMockFunction(fn: any) {
    return typeof fn === 'function'
      && '__isSpy' in fn
      && fn.__isSpy
  }

  public clearAllMocks() {
    spies.forEach((spy) => {
      spy.reset()
    })
  }

  public resetAllMocks() {
    spies.forEach((spy) => {
      spy.reset()
    })
  }

  public restoreAllMocks() {
    spies.forEach((spy) => {
      spy.restore()
    })
  }
}

export const vitest = new VitestUtils()
export const vi = vitest
