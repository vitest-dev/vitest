/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of https://github.com/facebook/jest.
 */

import type {
  FakeTimerInstallOpts,
  FakeTimerWithContext,
  InstalledClock,
} from '@sinonjs/fake-timers'
import { withGlobal } from '@sinonjs/fake-timers'
import { isChildProcess } from '../../runtime/utils'
import { mockDate, RealDate, resetDate } from './date'

export class FakeTimers {
  private _global: typeof globalThis
  private _clock!: InstalledClock
  // | _fakingTime | _fakingDate |
  // +-------------+-------------+
  // | false       | falsy       | initial
  // | false       | truthy     | vi.setSystemTime called first (for mocking only Date without fake timers)
  // | true        | falsy       | vi.useFakeTimers called first
  // | true        | truthy     | unreachable
  private _fakingTime: boolean
  private _fakingDate: Date | null
  private _fakeTimers: FakeTimerWithContext
  private _userConfig?: FakeTimerInstallOpts
  private _now = RealDate.now

  constructor({
    global,
    config,
  }: {
    global: typeof globalThis
    config: FakeTimerInstallOpts
  }) {
    this._userConfig = config

    this._fakingDate = null

    this._fakingTime = false
    this._fakeTimers = withGlobal(global)
    this._global = global
  }

  clearAllTimers(): void {
    if (this._fakingTime) {
      this._clock.reset()
    }
  }

  dispose(): void {
    this.useRealTimers()
  }

  runAllTimers(): void {
    if (this._checkFakeTimers()) {
      this._clock.runAll()
    }
  }

  async runAllTimersAsync(): Promise<void> {
    if (this._checkFakeTimers()) {
      await this._clock.runAllAsync()
    }
  }

  runOnlyPendingTimers(): void {
    if (this._checkFakeTimers()) {
      this._clock.runToLast()
    }
  }

  async runOnlyPendingTimersAsync(): Promise<void> {
    if (this._checkFakeTimers()) {
      await this._clock.runToLastAsync()
    }
  }

  advanceTimersToNextTimer(steps = 1): void {
    if (this._checkFakeTimers()) {
      for (let i = steps; i > 0; i--) {
        this._clock.next()
        // Fire all timers at this point: https://github.com/sinonjs/fake-timers/issues/250
        this._clock.tick(0)

        if (this._clock.countTimers() === 0) {
          break
        }
      }
    }
  }

  async advanceTimersToNextTimerAsync(steps = 1): Promise<void> {
    if (this._checkFakeTimers()) {
      for (let i = steps; i > 0; i--) {
        await this._clock.nextAsync()
        // Fire all timers at this point: https://github.com/sinonjs/fake-timers/issues/250
        this._clock.tick(0)

        if (this._clock.countTimers() === 0) {
          break
        }
      }
    }
  }

  advanceTimersByTime(msToRun: number): void {
    if (this._checkFakeTimers()) {
      this._clock.tick(msToRun)
    }
  }

  async advanceTimersByTimeAsync(msToRun: number): Promise<void> {
    if (this._checkFakeTimers()) {
      await this._clock.tickAsync(msToRun)
    }
  }

  advanceTimersToNextFrame(): void {
    if (this._checkFakeTimers()) {
      this._clock.runToFrame()
    }
  }

  runAllTicks(): void {
    if (this._checkFakeTimers()) {
      // @ts-expect-error method not exposed
      this._clock.runMicrotasks()
    }
  }

  useRealTimers(): void {
    if (this._fakingDate) {
      resetDate()
      this._fakingDate = null
    }

    if (this._fakingTime) {
      this._clock.uninstall()
      this._fakingTime = false
    }
  }

  useFakeTimers(): void {
    if (this._fakingDate) {
      throw new Error(
        '"setSystemTime" was called already and date was mocked. Reset timers using `vi.useRealTimers()` if you want to use fake timers again.',
      )
    }

    if (!this._fakingTime) {
      const toFake = Object.keys(this._fakeTimers.timers)
        // Do not mock timers internally used by node by default. It can still be mocked through userConfig.
        .filter(
          timer => timer !== 'nextTick' && timer !== 'queueMicrotask',
        ) as (keyof FakeTimerWithContext['timers'])[]

      if (this._userConfig?.toFake?.includes('nextTick') && isChildProcess()) {
        throw new Error(
          'process.nextTick cannot be mocked inside child_process',
        )
      }

      this._clock = this._fakeTimers.install({
        now: Date.now(),
        ...this._userConfig,
        toFake: this._userConfig?.toFake || toFake,
        ignoreMissingTimers: true,
      })

      this._fakingTime = true
    }
  }

  reset(): void {
    if (this._checkFakeTimers()) {
      const { now } = this._clock
      this._clock.reset()
      this._clock.setSystemTime(now)
    }
  }

  setSystemTime(now?: string | number | Date): void {
    const date = (typeof now === 'undefined' || now instanceof Date) ? now : new Date(now)
    if (this._fakingTime) {
      this._clock.setSystemTime(date)
    }
    else {
      this._fakingDate = date ?? new Date(this.getRealSystemTime())
      mockDate(this._fakingDate)
    }
  }

  getMockedSystemTime(): Date | null {
    return this._fakingTime ? new Date(this._clock.now) : this._fakingDate
  }

  getRealSystemTime(): number {
    return this._now()
  }

  getTimerCount(): number {
    if (this._checkFakeTimers()) {
      return this._clock.countTimers()
    }

    return 0
  }

  configure(config: FakeTimerInstallOpts): void {
    this._userConfig = config
  }

  isFakeTimers(): boolean {
    return this._fakingTime
  }

  private _checkFakeTimers() {
    if (!this._fakingTime) {
      throw new Error(
        'Timers are not mocked. Try calling "vi.useFakeTimers()" first.',
      )
    }

    return this._fakingTime
  }
}
