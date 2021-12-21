import { spies } from 'tinyspy'
import mockdate from 'mockdate'
import { FakeTimers } from './timers'
import { fn, spyOn } from './jest-mock'

class VitestUtils {
  private _timers: FakeTimers
  private _systemDate: string | number | Date | null

  constructor() {
    this._timers = new FakeTimers()
    this._systemDate = null
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

  public setSystemDate(date: string | number | Date) {
    this._systemDate = date
    mockdate.set(date)
  }

  public resetSystemDate() {
    this._systemDate = null
    mockdate.reset()
  }

  public getSystemDate() {
    return this._systemDate || Date.now()
  }

  // mocks

  spyOn = spyOn
  fn = fn
  mock = (path: string) => path

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
