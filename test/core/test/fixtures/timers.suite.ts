/* eslint-disable no-restricted-globals */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck taken from Jest, but tsconfig doesn't allow most of the code

/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of https://github.com/facebook/jest.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { FakeTimers } from '../../../../packages/vitest/src/integrations/mock/timers'

class FakeDate extends Date {}

const isChildProcess = !!process.send

describe('FakeTimers', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('construction', () => {
    it('installs setTimeout mock', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      expect(global.setTimeout).not.toBe(undefined)
    })

    it('installs clearTimeout mock', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      expect(global.clearTimeout).not.toBe(undefined)
    })

    it('installs setInterval mock', () => {
      const global = { Date: FakeDate, clearTimeout, clearInterval, process, setTimeout, setInterval }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      expect(global.setInterval).not.toBe(undefined)
    })

    it('installs clearInterval mock', () => {
      const global = { Date: FakeDate, clearTimeout, clearInterval, process, setTimeout, setInterval }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      expect(global.clearInterval).not.toBe(undefined)
    })

    it.skipIf(isChildProcess)('mocks process.nextTick if it exists on global', () => {
      const origNextTick = () => {}
      const global = {
        Date: FakeDate,
        clearTimeout,
        process: {
          nextTick: origNextTick,
        },
        setTimeout,
      }
      const timers = new FakeTimers({ global, config: { toFake: ['nextTick'] } })
      timers.useFakeTimers()
      expect(global.process.nextTick).not.toBe(origNextTick)
    })

    it.runIf(isChildProcess)('does not mock process.nextTick if it exists on global and is child_process', () => {
      const origNextTick = () => {}
      const global = {
        Date: FakeDate,
        clearTimeout,
        process: {
          nextTick: origNextTick,
        },
        setTimeout,
      }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      expect(global.process.nextTick).toBe(origNextTick)
    })

    it.runIf(isChildProcess)('throws when is child_process and tries to mock nextTick', () => {
      const global = { Date: FakeDate, process, setTimeout, clearTimeout }
      const timers = new FakeTimers({ global, config: { toFake: ['nextTick'] } })

      expect(() => timers.useFakeTimers()).toThrow(
        'process.nextTick cannot be mocked inside child_process',
      )
    })

    it('mocks setImmediate if it exists on global', () => {
      const origSetImmediate = () => {}
      const global = {
        Date: FakeDate,
        clearTimeout,
        process,
        setImmediate: origSetImmediate,
        setTimeout,
      }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      expect(global.setImmediate).not.toBe(origSetImmediate)
    })

    it('mocks clearImmediate if setImmediate is on global', () => {
      const origSetImmediate = () => {}
      const origClearImmediate = () => {}
      const global = {
        Date: FakeDate,
        clearImmediate: origClearImmediate,
        clearTimeout,
        process,
        setImmediate: origSetImmediate,
        setTimeout,
      }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      expect(global.clearImmediate).not.toBe(origClearImmediate)
    })

    it('mocks requestIdleCallback if it exists on global', () => {
      const origRequestIdleCallback = () => {}
      const global = { Date: FakeDate, clearTimeout, setTimeout, requestIdleCallback: origRequestIdleCallback }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      expect(global.requestIdleCallback).not.toBe(origRequestIdleCallback)
    })

    it('cannot mock setImmediate and clearImmediate if not on global', () => {
      const global = { Date: FakeDate, clearTimeout, setTimeout };
      const timers = new FakeTimers({ global, config: { toFake: ["setImmediate", "clearImmediate"] }})
      timers.useFakeTimers()
      expect(global.setImmediate).toBeUndefined();
      expect(global.clearImmediate).toBeUndefined();
    })
  })

  describe('runAllTicks', () => {
    it.skipIf(isChildProcess)('runs all ticks, in order', () => {
      const global = {
        Date: FakeDate,
        clearTimeout,
        process: {
          nextTick: () => {},
        },
        setTimeout,
      }

      const timers = new FakeTimers({ global, config: { toFake: ['nextTick'] } })
      timers.useFakeTimers()

      const runOrder = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))

      global.process.nextTick(mock1)
      global.process.nextTick(mock2)

      expect(mock1).toHaveBeenCalledTimes(0)
      expect(mock2).toHaveBeenCalledTimes(0)

      timers.runAllTicks()

      expect(mock1).toHaveBeenCalledTimes(1)
      expect(mock2).toHaveBeenCalledTimes(1)
      expect(runOrder).toEqual(['mock1', 'mock2'])
    })

    it('does nothing when no ticks have been scheduled', () => {
      const nextTick = vi.fn()
      const global = {
        Date: FakeDate,
        clearTimeout,
        process: {
          nextTick,
        },
        setTimeout,
      }

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      timers.runAllTicks()

      expect(nextTick).toHaveBeenCalledTimes(0)
    })

    it.skipIf(isChildProcess)('only runs a scheduled callback once', () => {
      const global = {
        Date: FakeDate,
        clearTimeout,
        process: {
          nextTick: () => {},
        },
        setTimeout,
      }

      const timers = new FakeTimers({ global, config: { toFake: ['nextTick'] } })
      timers.useFakeTimers()

      const mock1 = vi.fn()
      global.process.nextTick(mock1)
      expect(mock1).toHaveBeenCalledTimes(0)

      timers.runAllTicks()
      expect(mock1).toHaveBeenCalledTimes(1)

      timers.runAllTicks()
      expect(mock1).toHaveBeenCalledTimes(1)
    })

    it.skipIf(isChildProcess)('throws before allowing infinite recursion', () => {
      const global = {
        Date: FakeDate,
        clearTimeout,
        process: {
          nextTick: () => {},
        },
        setTimeout,
      }

      const timers = new FakeTimers({ global, config: { loopLimit: 100, toFake: ['nextTick'] } })

      timers.useFakeTimers()

      global.process.nextTick(function infinitelyRecursingCallback() {
        global.process.nextTick(infinitelyRecursingCallback)
      })

      expect(() => {
        timers.runAllTicks()
      }).toThrow(
        'Aborting after running 100 timers, assuming an infinite loop!',
      )
    })
  })

  describe('runAllTimers', () => {
    it('runs all timers in order', () => {
      const global = { Date: FakeDate, clearTimeout, clearInterval, process, setTimeout, setInterval }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))
      const mock5 = vi.fn(() => runOrder.push('mock5'))
      const mock6 = vi.fn(() => runOrder.push('mock6'))

      global.setTimeout(mock1, 100)
      global.setTimeout(mock2, Number.NaN)
      global.setTimeout(mock3, 0)
      const intervalHandler = global.setInterval(() => {
        mock4()
        global.clearInterval(intervalHandler)
      }, 200)
      global.setTimeout(mock5, Number.POSITIVE_INFINITY)
      global.setTimeout(mock6, Number.NEGATIVE_INFINITY)

      timers.runAllTimers()
      expect(runOrder).toEqual([
        'mock2',
        'mock3',
        'mock5',
        'mock6',
        'mock1',
        'mock4',
      ])
    })

    it('warns when trying to advance timers while real timers are used', () => {
      const timers = new FakeTimers({
        config: {
          rootDir: __dirname,
        },
        global,
      })
      expect(() => timers.runAllTimers()).toThrow(/Timers are not mocked/)
    })

    it('does nothing when no timers have been scheduled', () => {
      const nativeSetTimeout = vi.fn()
      const global = {
        Date: FakeDate,
        clearTimeout,
        process,
        setTimeout: nativeSetTimeout,
      }

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()
      timers.runAllTimers()
    })

    it('only runs a setTimeout callback once (ever)', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const fn = vi.fn()
      global.setTimeout(fn, 0)
      expect(fn).toHaveBeenCalledTimes(0)

      timers.runAllTimers()
      expect(fn).toHaveBeenCalledTimes(1)

      timers.runAllTimers()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('runs callbacks with arguments after the interval', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const fn = vi.fn()
      global.setTimeout(fn, 0, 'mockArg1', 'mockArg2')

      timers.runAllTimers()
      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('mockArg1', 'mockArg2')
    })

    it('doesn\'t pass the callback to native setTimeout', () => {
      const nativeSetTimeout = vi.fn()

      const global = {
        Date: FakeDate,
        clearTimeout,
        process,
        setTimeout: nativeSetTimeout,
      }

      const timers = new FakeTimers({ global })
      // @sinonjs/fake-timers uses `setTimeout` during init to figure out if it's in Node or
      // browser env. So clear its calls before we install them into the env
      nativeSetTimeout.mockClear()
      timers.useFakeTimers()

      const mock1 = vi.fn()
      global.setTimeout(mock1, 0)

      timers.runAllTimers()
      expect(mock1).toHaveBeenCalledTimes(1)
      expect(nativeSetTimeout).toHaveBeenCalledTimes(0)
    })

    it('throws before allowing infinite recursion', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global, config: { loopLimit: 100 } })
      timers.useFakeTimers()

      global.setTimeout(function infinitelyRecursingCallback() {
        global.setTimeout(infinitelyRecursingCallback, 0)
      }, 0)

      expect(() => {
        timers.runAllTimers()
      }).toThrow(
        'Aborting after running 100 timers, assuming an infinite loop!',
      )
    })

    it.skipIf(isChildProcess)('also clears ticks', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global, config: { toFake: ['nextTick', 'setTimeout'] } })
      timers.useFakeTimers()

      const fn = vi.fn()
      global.setTimeout(() => {
        process.nextTick(fn)
      }, 0)
      expect(fn).toHaveBeenCalledTimes(0)

      timers.runAllTimers()
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('runAllTimersAsync', () => {
    it('runs all timers in order', async () => {
      const global = { Date: FakeDate, clearTimeout, clearInterval, process, setTimeout, setInterval, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))
      const mock5 = vi.fn(() => runOrder.push('mock5'))
      const mock6 = vi.fn(() => runOrder.push('mock6'))

      global.setTimeout(mock1, 100)
      global.setTimeout(mock2, Number.NaN)
      global.setTimeout(mock3, 0)
      const intervalHandler = global.setInterval(() => {
        mock4()
        global.clearInterval(intervalHandler)
      }, 200)
      global.setTimeout(mock5, Number.POSITIVE_INFINITY)
      global.setTimeout(mock6, Number.NEGATIVE_INFINITY)

      await timers.runAllTimersAsync()
      expect(runOrder).toEqual([
        'mock2',
        'mock3',
        'mock5',
        'mock6',
        'mock1',
        'mock4',
      ])
    })

    it('warns when trying to advance timers while real timers are used', async () => {
      const timers = new FakeTimers({
        config: {
          rootDir: __dirname,
        },
        global,
      })
      await expect(timers.runAllTimersAsync()).rejects.toThrow(/Timers are not mocked/)
    })

    it('only runs a setTimeout callback once (ever)', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const fn = vi.fn()
      global.setTimeout(fn, 0)
      expect(fn).toHaveBeenCalledTimes(0)

      await timers.runAllTimersAsync()
      expect(fn).toHaveBeenCalledTimes(1)

      await timers.runAllTimersAsync()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('runs callbacks with arguments after the interval', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const fn = vi.fn()
      global.setTimeout(fn, 0, 'mockArg1', 'mockArg2')

      await timers.runAllTimersAsync()
      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('mockArg1', 'mockArg2')
    })

    it('throws before allowing infinite recursion', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, Promise }
      const timers = new FakeTimers({ global, config: { loopLimit: 20 } })
      timers.useFakeTimers()

      global.setTimeout(function infinitelyRecursingCallback() {
        global.setTimeout(infinitelyRecursingCallback, 0)
      }, 0)

      await expect(
        timers.runAllTimersAsync(),
      ).rejects.toThrow(
        'Aborting after running 20 timers, assuming an infinite loop!',
      )
    })

    it.skipIf(isChildProcess)('also clears ticks', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, Promise }
      const timers = new FakeTimers({ global, config: { toFake: ['setTimeout', 'nextTick'] } })
      timers.useFakeTimers()

      const fn = vi.fn()
      global.setTimeout(() => {
        process.nextTick(fn)
      }, 0)
      expect(fn).toHaveBeenCalledTimes(0)

      await timers.runAllTimersAsync()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('all callbacks are called when setTimeout calls asynchronous method', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder = []
      const mock2 = vi.fn(async () => {
        runOrder.push('mock2')
        return global.Promise.resolve(true)
      })
      const mock1 = vi.fn(async () => {
        await mock2()
        runOrder.push('mock1')
      })

      global.setTimeout(mock1, 100)
      await timers.runAllTimersAsync()

      expect(runOrder).toEqual([
        'mock2',
        'mock1',
      ])
    })
  })

  describe('advanceTimersByTime', () => {
    it('runs timers in order', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, setInterval }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))

      global.setTimeout(mock1, 100)
      global.setTimeout(mock2, 0)
      global.setTimeout(mock3, 0)
      global.setInterval(() => {
        mock4()
      }, 200)

      // Move forward to t=50
      timers.advanceTimersByTime(50)
      expect(runOrder).toEqual(['mock2', 'mock3'])

      // Move forward to t=60
      timers.advanceTimersByTime(10)
      expect(runOrder).toEqual(['mock2', 'mock3'])

      // Move forward to t=100
      timers.advanceTimersByTime(40)
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1'])

      // Move forward to t=200
      timers.advanceTimersByTime(100)
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1', 'mock4'])

      // Move forward to t=400
      timers.advanceTimersByTime(200)
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1', 'mock4', 'mock4'])
    })

    it('does nothing when no timers have been scheduled', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      timers.advanceTimersByTime(100)
    })
  })

  describe('advanceTimersByTimeAsync', () => {
    it('runs timers in order', async () => {
      const global = { Date: FakeDate, clearTimeout, clearInterval, process, setTimeout, setInterval, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))

      global.setTimeout(mock1, 100)
      global.setTimeout(mock2, 0)
      global.setTimeout(mock3, 0)
      global.setInterval(() => {
        mock4()
      }, 200)

      // Move forward to t=50
      await timers.advanceTimersByTimeAsync(50)
      expect(runOrder).toEqual(['mock2', 'mock3'])

      // Move forward to t=60
      await timers.advanceTimersByTimeAsync(10)
      expect(runOrder).toEqual(['mock2', 'mock3'])

      // Move forward to t=100
      await timers.advanceTimersByTimeAsync(40)
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1'])

      // Move forward to t=200
      await timers.advanceTimersByTimeAsync(100)
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1', 'mock4'])

      // Move forward to t=400
      await timers.advanceTimersByTimeAsync(200)
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1', 'mock4', 'mock4'])
    })

    it('does nothing when no timers have been scheduled', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      await timers.advanceTimersByTimeAsync(100)
    })
  })

  describe('advanceTimersToNextTimer', () => {
    it('runs timers in order', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, setInterval }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))

      global.setTimeout(mock1, 100)
      global.setTimeout(mock2, 0)
      global.setTimeout(mock3, 0)
      global.setInterval(() => {
        mock4()
      }, 200)

      timers.advanceTimersToNextTimer()
      // Move forward to t=0
      expect(runOrder).toEqual(['mock2', 'mock3'])

      timers.advanceTimersToNextTimer()
      // Move forward to t=100
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1'])

      timers.advanceTimersToNextTimer()
      // Move forward to t=200
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1', 'mock4'])

      timers.advanceTimersToNextTimer()
      // Move forward to t=400
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1', 'mock4', 'mock4'])
    })

    it('run correct amount of steps', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, setInterval }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))

      global.setTimeout(mock1, 100)
      global.setTimeout(mock2, 0)
      global.setTimeout(mock3, 0)
      global.setInterval(() => {
        mock4()
      }, 200)

      // Move forward to t=100
      timers.advanceTimersToNextTimer(2)
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1'])

      // Move forward to t=600
      timers.advanceTimersToNextTimer(3)
      expect(runOrder).toEqual([
        'mock2',
        'mock3',
        'mock1',
        'mock4',
        'mock4',
        'mock4',
      ])
    })

    it('setTimeout inside setTimeout', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))

      global.setTimeout(mock1, 0)
      global.setTimeout(() => {
        mock2()
        global.setTimeout(mock3, 50)
      }, 25)
      global.setTimeout(mock4, 100)

      // Move forward to t=75
      timers.advanceTimersToNextTimer(3)
      expect(runOrder).toEqual(['mock1', 'mock2', 'mock3'])
    })

    it('does nothing when no timers have been scheduled', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      timers.advanceTimersToNextTimer()
    })
  })

  describe('advanceTimersToNextTimerAsync', () => {
    it('runs timers in order', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, setInterval, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))

      global.setTimeout(mock1, 100)
      global.setTimeout(mock2, 0)
      global.setTimeout(mock3, 0)
      global.setInterval(() => {
        mock4()
      }, 200)

      await timers.advanceTimersToNextTimer()
      // Move forward to t=0
      expect(runOrder).toEqual(['mock2', 'mock3'])

      await timers.advanceTimersToNextTimer()
      // Move forward to t=100
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1'])

      await timers.advanceTimersToNextTimer()
      // Move forward to t=200
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1', 'mock4'])

      await timers.advanceTimersToNextTimer()
      // Move forward to t=400
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1', 'mock4', 'mock4'])
    })

    it('run correct amount of steps', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, setInterval, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))

      global.setTimeout(mock1, 100)
      global.setTimeout(mock2, 0)
      global.setTimeout(mock3, 0)
      global.setInterval(() => {
        mock4()
      }, 200)

      // Move forward to t=100
      await timers.advanceTimersToNextTimer(2)
      expect(runOrder).toEqual(['mock2', 'mock3', 'mock1'])

      // Move forward to t=600
      await timers.advanceTimersToNextTimer(3)
      expect(runOrder).toEqual([
        'mock2',
        'mock3',
        'mock1',
        'mock4',
        'mock4',
        'mock4',
      ])
    })

    it('setTimeout inside setTimeout', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))
      const mock4 = vi.fn(() => runOrder.push('mock4'))

      global.setTimeout(mock1, 0)
      global.setTimeout(() => {
        mock2()
        global.setTimeout(mock3, 50)
      }, 25)
      global.setTimeout(mock4, 100)

      // Move forward to t=75
      await timers.advanceTimersToNextTimer(3)
      expect(runOrder).toEqual(['mock1', 'mock2', 'mock3'])
    })

    it('does nothing when no timers have been scheduled', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      await timers.advanceTimersToNextTimer()
    })
  })

  describe('advanceTimersToNextFrame', () => {
    it('runs scheduled animation frame callbacks in order', () => {
      const global = {
        Date,
        clearTimeout,
        process,
        requestAnimationFrame: () => -1,
        setTimeout,
      } as unknown as typeof globalThis

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []
      const mock1 = vi.fn(() => runOrder.push('mock1'))
      const mock2 = vi.fn(() => runOrder.push('mock2'))
      const mock3 = vi.fn(() => runOrder.push('mock3'))

      global.requestAnimationFrame(mock1)
      global.requestAnimationFrame(mock2)
      global.requestAnimationFrame(mock3)

      timers.advanceTimersToNextFrame()

      expect(runOrder).toEqual(['mock1', 'mock2', 'mock3'])
    })

    it('should only run currently scheduled animation frame callbacks', () => {
      const global = {
        Date,
        clearTimeout,
        process,
        requestAnimationFrame: () => -1,
        setTimeout,
      } as unknown as typeof globalThis

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []
      function run() {
        runOrder.push('first-frame')

        // scheduling another animation frame in the first frame
        global.requestAnimationFrame(() => runOrder.push('second-frame'))
      }

      global.requestAnimationFrame(run)

      // only the first frame should be executed
      timers.advanceTimersToNextFrame()

      expect(runOrder).toEqual(['first-frame'])

      timers.advanceTimersToNextFrame()

      expect(runOrder).toEqual(['first-frame', 'second-frame'])
    })

    it('should allow cancelling of scheduled animation frame callbacks', () => {
      const global = {
        Date,
        cancelAnimationFrame: () => {},
        clearTimeout,
        process,
        requestAnimationFrame: () => -1,
        setTimeout,
      } as unknown as typeof globalThis

      const timers = new FakeTimers({ global })
      const callback = vi.fn()
      timers.useFakeTimers()

      const timerId = global.requestAnimationFrame(callback)
      global.cancelAnimationFrame(timerId)

      timers.advanceTimersToNextFrame()

      expect(callback).not.toHaveBeenCalled()
    })

    it('should only advance as much time is needed to get to the next frame', () => {
      const global = {
        Date,
        cancelAnimationFrame: () => {},
        clearTimeout,
        process,
        requestAnimationFrame: () => -1,
        setTimeout,
      } as unknown as typeof globalThis

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []
      const start = global.Date.now()

      const callback = () => runOrder.push('frame')
      global.requestAnimationFrame(callback)

      // Advancing timers less than a frame (which is 16ms)
      timers.advanceTimersByTime(6)
      expect(global.Date.now()).toEqual(start + 6)

      // frame not yet executed
      expect(runOrder).toEqual([])

      // move timers forward to execute frame
      timers.advanceTimersToNextFrame()

      // frame has executed as time has moved forward 10ms to get to the 16ms frame time
      expect(runOrder).toEqual(['frame'])
      expect(global.Date.now()).toEqual(start + 16)
    })

    it('should execute any timers on the way to the animation frame', () => {
      const global = {
        Date,
        cancelAnimationFrame: () => {},
        clearTimeout,
        process,
        requestAnimationFrame: () => -1,
        setTimeout,
      } as unknown as typeof globalThis

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []

      global.requestAnimationFrame(() => runOrder.push('frame'))

      // scheduling a timeout that will be executed on the way to the frame
      global.setTimeout(() => runOrder.push('timeout'), 10)

      // move timers forward to execute frame
      timers.advanceTimersToNextFrame()

      expect(runOrder).toEqual(['timeout', 'frame'])
    })

    it('should not execute any timers scheduled inside of an animation frame callback', () => {
      const global = {
        Date,
        cancelAnimationFrame: () => {},
        clearTimeout,
        process,
        requestAnimationFrame: () => -1,
        setTimeout,
      } as unknown as typeof globalThis

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder: Array<string> = []

      global.requestAnimationFrame(() => {
        runOrder.push('frame')
        // scheduling a timer inside of a frame
        global.setTimeout(() => runOrder.push('timeout'), 1)
      })

      timers.advanceTimersToNextFrame()

      // timeout not yet executed
      expect(runOrder).toEqual(['frame'])

      // validating that the timer will still be executed
      timers.advanceTimersByTime(1)
      expect(runOrder).toEqual(['frame', 'timeout'])
    })

    it('should call animation frame callbacks with the latest system time', () => {
      const global = {
        Date,
        clearTimeout,
        performance,
        process,
        requestAnimationFrame: () => -1,
        setTimeout,
      } as unknown as typeof globalThis

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const callback = vi.fn()

      global.requestAnimationFrame(callback)

      timers.advanceTimersToNextFrame()

      // `requestAnimationFrame` callbacks are called with a `DOMHighResTimeStamp`
      expect(callback).toHaveBeenCalledWith(global.performance.now())
    })
  })

  describe('reset', () => {
    it('resets all pending setTimeouts', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const mock1 = vi.fn()
      global.setTimeout(mock1, 100)

      timers.reset()
      timers.runAllTimers()
      expect(mock1).toHaveBeenCalledTimes(0)
    })

    it('resets all pending setIntervals', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, setInterval }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const mock1 = vi.fn()
      global.setInterval(mock1, 200)

      timers.reset()
      timers.runAllTimers()
      expect(mock1).toHaveBeenCalledTimes(0)
    })

    it('resets all pending ticks callbacks', () => {
      const global = {
        Date: FakeDate,
        clearTimeout,
        process: {
          nextTick: () => {},
        },
        setImmediate: () => {},
        setTimeout,
      }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const mock1 = vi.fn()
      global.process.nextTick(mock1)
      global.setImmediate(mock1)

      timers.reset()
      timers.runAllTicks()
      expect(mock1).toHaveBeenCalledTimes(0)
    })

    it('resets current advanceTimersByTime time cursor', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const mock1 = vi.fn()
      global.setTimeout(mock1, 100)
      timers.advanceTimersByTime(50)

      timers.reset()
      global.setTimeout(mock1, 100)

      timers.advanceTimersByTime(50)
      expect(mock1).toHaveBeenCalledTimes(0)
    })
  })

  describe('runOnlyPendingTimers', () => {
    it('runs all timers in order', () => {
      const nativeSetImmediate = vi.fn()

      const global = {
        Date: FakeDate,
        clearTimeout,
        process,
        setImmediate: nativeSetImmediate,
        setTimeout,
        setInterval,
      }

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder = []

      global.setTimeout(function cb() {
        runOrder.push('mock1')
        global.setTimeout(cb, 100)
      }, 100)

      global.setTimeout(function cb() {
        runOrder.push('mock2')
        global.setTimeout(cb, 50)
      }, 0)

      global.setInterval(() => {
        runOrder.push('mock3')
      }, 200)

      global.setImmediate(() => {
        runOrder.push('mock4')
      })

      global.setImmediate(function cb() {
        runOrder.push('mock5')
        global.setTimeout(cb, 400)
      })

      timers.runOnlyPendingTimers()
      const firsRunOrder = [
        'mock4',
        'mock5',
        'mock2',
        'mock2',
        'mock1',
        'mock2',
        'mock2',
        'mock3',
        'mock1',
        'mock2',
      ]

      expect(runOrder).toEqual(firsRunOrder)

      timers.runOnlyPendingTimers()
      expect(runOrder).toEqual([
        ...firsRunOrder,
        'mock2',
        'mock1',
        'mock2',
        'mock2',
        'mock3',
        'mock5',
        'mock1',
        'mock2',
      ])
    })

    it('does not run timers that were cleared in another timer', () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const fn = vi.fn()
      const timer = global.setTimeout(fn, 10)
      global.setTimeout(() => {
        global.clearTimeout(timer)
      }, 0)

      timers.runOnlyPendingTimers()
      expect(fn).not.toBeCalled()
    })
  })

  describe('runOnlyPendingTimersAsync', () => {
    it('runs all existing timers', async () => {
      const global = {
        Date: FakeDate,
        clearTimeout,
        process,
        setTimeout,
        Promise,
      }

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const spies = [vi.fn(), vi.fn()]
      global.setTimeout(spies[0], 10)
      global.setTimeout(spies[1], 50)

      await timers.runOnlyPendingTimersAsync()

      expect(spies[0]).toBeCalled()
      expect(spies[1]).toBeCalled()
    })

    it('runs all timers in order', async () => {
      const global = {
        Date: FakeDate,
        clearTimeout,
        process,
        setImmediate,
        setTimeout,
        setInterval,
        Promise,
      }

      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const runOrder = []

      global.setTimeout(function cb() {
        runOrder.push('mock1')
        global.setTimeout(cb, 100)
      }, 100)

      global.setTimeout(function cb() {
        runOrder.push('mock2')
        global.setTimeout(cb, 50)
      }, 0)

      global.setInterval(() => {
        runOrder.push('mock3')
      }, 200)

      global.setImmediate(() => {
        runOrder.push('mock4')
      })

      global.setImmediate(function cb() {
        runOrder.push('mock5')
        global.setTimeout(cb, 400)
      })

      await timers.runOnlyPendingTimersAsync()
      const firsRunOrder = [
        'mock4',
        'mock5',
        'mock2',
        'mock2',
        'mock1',
        'mock2',
        'mock2',
        'mock3',
        'mock1',
        'mock2',
      ]

      expect(runOrder).toEqual(firsRunOrder)

      await timers.runOnlyPendingTimersAsync()
      expect(runOrder).toEqual([
        ...firsRunOrder,
        'mock2',
        'mock1',
        'mock2',
        'mock2',
        'mock3',
        'mock5',
        'mock1',
        'mock2',
      ])
    })

    it('does not run timers that were cleared in another timer', async () => {
      const global = { Date: FakeDate, clearTimeout, process, setTimeout, Promise }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      const fn = vi.fn()
      const timer = global.setTimeout(fn, 10)
      global.setTimeout(() => {
        global.clearTimeout(timer)
      }, 0)

      await timers.runOnlyPendingTimersAsync()
      expect(fn).not.toBeCalled()
    })
  })

  describe('useRealTimers', () => {
    it('resets native timer APIs', () => {
      const nativeSetTimeout = vi.fn()
      const nativeSetInterval = vi.fn()
      const nativeClearTimeout = vi.fn()
      const nativeClearInterval = vi.fn()

      const global = {
        Date: FakeDate,
        clearInterval: nativeClearInterval,
        clearTimeout: nativeClearTimeout,
        process,
        setInterval: nativeSetInterval,
        setTimeout: nativeSetTimeout,
      }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      // Ensure that timers has overridden the native timer APIs
      // (because if it didn't, this test might pass when it shouldn't)
      expect(global.setTimeout).not.toBe(nativeSetTimeout)
      expect(global.setInterval).not.toBe(nativeSetInterval)
      expect(global.clearTimeout).not.toBe(nativeClearTimeout)
      expect(global.clearInterval).not.toBe(nativeClearInterval)

      timers.useRealTimers()

      expect(global.setTimeout).toBe(nativeSetTimeout)
      expect(global.setInterval).toBe(nativeSetInterval)
      expect(global.clearTimeout).toBe(nativeClearTimeout)
      expect(global.clearInterval).toBe(nativeClearInterval)
    })

    it.skipIf(isChildProcess)('resets native process.nextTick when present', () => {
      const nativeProcessNextTick = vi.fn()

      const global = {
        Date: FakeDate,
        clearTimeout,
        process: { nextTick: nativeProcessNextTick },
        setTimeout,
      }
      const timers = new FakeTimers({ global, config: { toFake: ['nextTick'] } })
      timers.useFakeTimers()

      // Ensure that timers has overridden the native timer APIs
      // (because if it didn't, this test might pass when it shouldn't)
      expect(global.process.nextTick).not.toBe(nativeProcessNextTick)

      timers.useRealTimers()

      expect(global.process.nextTick).toBe(nativeProcessNextTick)
    })

    it('resets native setImmediate when present', () => {
      const nativeSetImmediate = vi.fn()
      const nativeClearImmediate = vi.fn()

      const global = {
        Date: FakeDate,
        clearImmediate: nativeClearImmediate,
        clearTimeout,
        process,
        setImmediate: nativeSetImmediate,
        setTimeout,
      }
      const timers = new FakeTimers({ global })
      timers.useFakeTimers()

      // Ensure that timers has overridden the native timer APIs
      // (because if it didn't, this test might pass when it shouldn't)
      expect(global.setImmediate).not.toBe(nativeSetImmediate)
      expect(global.clearImmediate).not.toBe(nativeClearImmediate)

      timers.useRealTimers()

      expect(global.setImmediate).toBe(nativeSetImmediate)
      expect(global.clearImmediate).toBe(nativeClearImmediate)
    })
  })

  describe('useFakeTimers', () => {
    it('resets mock timer APIs', () => {
      const nativeSetTimeout = vi.fn()
      const nativeSetInterval = vi.fn()
      const nativeClearTimeout = vi.fn()
      const nativeClearInterval = vi.fn()

      const global = {
        Date: FakeDate,
        clearInterval: nativeClearInterval,
        clearTimeout: nativeClearTimeout,
        process,
        setInterval: nativeSetInterval,
        setTimeout: nativeSetTimeout,
      }
      const timers = new FakeTimers({ global })
      timers.useRealTimers()

      // Ensure that the real timers are installed at this point
      // (because if they aren't, this test might pass when it shouldn't)
      expect(global.setTimeout).toBe(nativeSetTimeout)
      expect(global.setInterval).toBe(nativeSetInterval)
      expect(global.clearTimeout).toBe(nativeClearTimeout)
      expect(global.clearInterval).toBe(nativeClearInterval)

      timers.useFakeTimers()

      expect(global.setTimeout).not.toBe(nativeSetTimeout)
      expect(global.setInterval).not.toBe(nativeSetInterval)
      expect(global.clearTimeout).not.toBe(nativeClearTimeout)
      expect(global.clearInterval).not.toBe(nativeClearInterval)
    })

    it.skipIf(isChildProcess)('resets mock process.nextTick when present', () => {
      const nativeProcessNextTick = vi.fn()

      const global = {
        Date: FakeDate,
        clearTimeout,
        process: { nextTick: nativeProcessNextTick },
        setTimeout,
      }
      const timers = new FakeTimers({ global, config: { toFake: ['nextTick'] } })
      timers.useRealTimers()

      // Ensure that the real timers are installed at this point
      // (because if they aren't, this test might pass when it shouldn't)
      expect(global.process.nextTick).toBe(nativeProcessNextTick)

      timers.useFakeTimers()

      expect(global.process.nextTick).not.toBe(nativeProcessNextTick)
    })

    it('resets mock setImmediate when present', () => {
      const nativeSetImmediate = vi.fn()
      const nativeClearImmediate = vi.fn()

      const global = {
        Date: FakeDate,
        clearImmediate: nativeClearImmediate,
        clearTimeout,
        process,
        setImmediate: nativeSetImmediate,
        setTimeout,
      }
      const fakeTimers = new FakeTimers({ global })
      fakeTimers.useRealTimers()

      // Ensure that the real timers are installed at this point
      // (because if they aren't, this test might pass when it shouldn't)
      expect(global.setImmediate).toBe(nativeSetImmediate)
      expect(global.clearImmediate).toBe(nativeClearImmediate)

      fakeTimers.useFakeTimers()

      expect(global.setImmediate).not.toBe(nativeSetImmediate)
      expect(global.clearImmediate).not.toBe(nativeClearImmediate)

      fakeTimers.useRealTimers()
    })
  })

  describe('getTimerCount', () => {
    it('returns the correct count', () => {
      const timers = new FakeTimers({ global })

      timers.useFakeTimers()

      global.setTimeout(() => {}, 0)
      global.setTimeout(() => {}, 0)
      global.setTimeout(() => {}, 10)

      expect(timers.getTimerCount()).toEqual(3)

      timers.advanceTimersByTime(5)

      expect(timers.getTimerCount()).toEqual(1)

      timers.advanceTimersByTime(5)

      expect(timers.getTimerCount()).toEqual(0)

      timers.useRealTimers()
    })

    it.skipIf(isChildProcess)('includes immediates and ticks', () => {
      const timers = new FakeTimers({ global, config: { toFake: ['setTimeout', 'setImmediate', 'nextTick'] } })

      timers.useFakeTimers()

      global.setTimeout(() => {}, 0)
      global.setImmediate(() => {})
      process.nextTick(() => {})

      expect(timers.getTimerCount()).toEqual(3)

      timers.useRealTimers()
    })

    it('not includes cancelled immediates', () => {
      const timers = new FakeTimers({ global })

      timers.useFakeTimers()

      global.setImmediate(() => {})
      expect(timers.getTimerCount()).toEqual(1)
      timers.clearAllTimers()

      expect(timers.getTimerCount()).toEqual(0)

      timers.useRealTimers()
    })

    it('throws when using useFakeTimers after setSystemTime', () => {
      const timers = new FakeTimers({ global })

      const timeStr = 'Fri Feb 20 2015 19:29:31 GMT+0530'
      const timeStrMs = 1424440771000

      timers.setSystemTime(timeStr)

      expect(Date.now()).toBe(timeStrMs)

      expect(() => timers.useFakeTimers()).toThrowError(/date was mocked/)

      // Some test

      timers.useRealTimers()
    })
  })
})
