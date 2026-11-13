/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of https://github.com/jestjs/jest.
 */

import type {
  Clock,
  FakeMethod,
  FakeTimers as FakeTimersContext,
  Config as SinonFakeTimersConfig,
  TemporalTimelike,
} from '@sinonjs/fake-timers'
import type { RandomSource } from '@vitest/utils/random-source'
import type { TimerSchedule } from './timer-schedule'
import { withGlobal } from '@sinonjs/fake-timers'
import { isChildProcess } from '../../runtime/utils'
import { createTimerSchedule } from './timer-schedule'

const RealDate = globalThis.Date

// Custom options are implemented by patching the package
export interface FakeTimersConfig extends SinonFakeTimersConfig {
  /**
   * Mock timer APIs imported from `node:timers` and `node:timers/promises`.
   *
   * @default false
   */
  fakeNodeBuiltins?: boolean
  /**
   * The order of timeouts, intervals and animation frames that are due at the same time. With `'random'`, timers that were
   * created at different times run in an order that comes from the seed of the current test.
   * Timers keep the order that Node.js and browsers guarantee.
   * @default 'fifo'
   * @experimental
   * @see {@link https://vitest.dev/config/faketimers#faketimers-order}
   */
  order?: 'fifo' | 'random'
  /**
   * The maximum number of milliseconds that a timer can be late. The delay of each timer comes from
   * the seed of the current test. Timers keep the order that Node.js and browsers guarantee.
   * @default 0
   * @experimental
   * @see {@link https://vitest.dev/config/faketimers#faketimers-jitter}
   */
  jitter?: number
}

export class FakeTimers {
  private _global: typeof globalThis
  private _clock!: Clock
  // | _fakingTime | _fakingDate |
  // +-------------+-------------+
  // | false       | falsy       | initial
  // | false       | truthy      | vi.setSystemTime called first (for mocking only Date without fake timers)
  // | true        | falsy       | vi.useFakeTimers called first
  // | true        | truthy      | unreachable
  private _fakingTime: boolean
  private _fakingDate: Date | null
  private _fakeTimers: FakeTimersContext
  private _userConfig?: FakeTimersConfig
  private _now = RealDate.now
  private _getRandom?: () => RandomSource
  private _schedule?: TimerSchedule

  constructor({
    global,
    config,
    getRandom,
  }: {
    global: typeof globalThis
    config: FakeTimersConfig
    getRandom?: () => RandomSource
  }) {
    this._userConfig = config
    this._getRandom = getRandom

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
      // with a jitter, the next frame can be late by whole frames
      const frameTime = this._schedule?.getNextFrameTime()
      if (frameTime === undefined) {
        this._clock.runToFrame()
      } else {
        this._clock.tick(Math.max(0, frameTime - this._clock.now))
      }
    }
  }

  runAllTicks(): void {
    if (this._checkFakeTimers()) {
      this._clock.runMicrotasks()
    }
  }

  useRealTimers(): void {
    if (this._fakingDate) {
      this._clock.uninstall()
      this._fakingDate = null
    }

    if (this._fakingTime) {
      this._clock.uninstall()
      this._fakingTime = false
    }
  }

  useFakeTimers(): void {
    const schedule = createTimerSchedule(
      this._userConfig?.order,
      this._userConfig?.jitter,
      this._getRandom,
    )
    const fakeDate = this._fakingDate || Date.now()
    if (this._fakingDate) {
      this._clock.uninstall()
      this._fakingDate = null
    }

    if (this._fakingTime) {
      this._clock.uninstall()
    }

    let toFake = this._userConfig?.toFake
    if (isChildProcess() && toFake?.includes('nextTick')) {
      throw new Error('process.nextTick cannot be mocked inside child_process')
    }

    let toNotFake = this._userConfig?.toNotFake
    if (toFake === undefined && toNotFake === undefined) {
      // Do not mock timers internally used by node by default. It can still be mocked through userConfig.
      toFake = (Object.keys(this._fakeTimers.timers) as FakeMethod[]).filter(
        (timer) => timer !== 'nextTick' && timer !== 'queueMicrotask',
      )
    } else if (toFake === undefined && toNotFake !== undefined) {
      // Do not mock timers internally used by node via `toNotFake`
      for (const timer of ['nextTick', 'queueMicrotask'] as const) {
        if (!toNotFake.includes(timer)) {
          toNotFake = [...toNotFake, timer]
        }
      }
    }
    if (isChildProcess() && toNotFake && !toNotFake.includes('nextTick')) {
      toNotFake = [...toNotFake, 'nextTick']
    }

    const installConfig = {
      now: fakeDate,
      ...this._userConfig,
      ...(toFake && { toFake }),
      ...(toNotFake && { toNotFake }),
      ignoreMissingTimers: true,
      // read by the patch of @sinonjs/fake-timers
      scheduleTimer: schedule?.scheduleTimer,
    }
    this._clock = this._fakeTimers.install(installConfig)
    this._schedule = schedule

    this._fakingTime = true
  }

  reset(): void {
    if (this._checkFakeTimers()) {
      const { now } = this._clock
      this._clock.reset()
      this._clock.setSystemTime(now)
    }
  }

  setSystemTime(now?: string | number | Date | TemporalTimelike): void {
    const normalized = normalizeSystemTime(now)
    const date =
      typeof normalized === 'undefined' || normalized instanceof Date
        ? normalized
        : new Date(normalized)
    if (this._fakingTime) {
      this._clock.setSystemTime(date)
    } else {
      const newFakingDate = date ?? new Date(this.getRealSystemTime())
      if (this._fakingDate) {
        this._fakingDate = newFakingDate
        this._clock.setSystemTime(newFakingDate)
      } else {
        this._fakingDate = newFakingDate
        this._clock = this._fakeTimers.install({
          now: newFakingDate,
          toFake: ['Date', 'Temporal'],
          ignoreMissingTimers: true,
        })
      }
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

  setTimerTickMode(mode: 'manual' | 'nextTimerAsync' | 'interval', interval?: number): void {
    if (this._checkFakeTimers()) {
      if (mode === 'manual') {
        this._clock.setTickMode({ mode: 'manual' })
      } else if (mode === 'nextTimerAsync') {
        this._clock.setTickMode({ mode: 'nextAsync' })
      } else if (mode === 'interval') {
        this._clock.setTickMode({ mode: 'interval', delta: interval })
      } else {
        throw new Error(`Invalid tick mode: ${mode}`)
      }
    }
  }

  configure(config: FakeTimersConfig): void {
    this._userConfig = config
  }

  isFakeTimers(): boolean {
    return this._fakingTime
  }

  private _checkFakeTimers() {
    if (!this._fakingTime) {
      throw new Error(
        'A function to advance timers was called but the timers APIs are not mocked. ' +
          'Call `vi.useFakeTimers()` in the test file first.',
      )
    }

    return this._fakingTime
  }
}

// Like fake-timers, read epochMilliseconds from Instant or ZonedDateTime without requiring built-in Temporal types.
function normalizeSystemTime(
  time?: string | number | Date | TemporalTimelike,
): string | number | Date | undefined {
  return time && typeof time === 'object' && 'epochMilliseconds' in time
    ? time.epochMilliseconds
    : time
}
