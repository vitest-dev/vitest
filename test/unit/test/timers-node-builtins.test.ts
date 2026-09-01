import { createRequire } from 'node:module'
import timers, { setTimeout as namedSetTimeout } from 'node:timers'
import * as timersNamespace from 'node:timers'
import timersPromises, { setTimeout as namedSetTimeoutPromise } from 'node:timers/promises'
import * as timersPromisesNamespace from 'node:timers/promises'
import { afterEach, expect, test, vi } from 'vitest'

const require = createRequire(import.meta.url)
const requiredTimers: typeof timers = require('node:timers')
const requiredTimersPromises: typeof timersPromises = require('node:timers/promises')

afterEach(() => {
  vi.useRealTimers()
})

test('does not mock Node timer imports by default', () => {
  const originalSetTimeout = timers.setTimeout
  const originalSetTimeoutPromise = timersPromises.setTimeout
  const originalNamedSetTimeout = namedSetTimeout
  const originalNamedSetTimeoutPromise = namedSetTimeoutPromise

  vi.useFakeTimers()

  expect(timers.setTimeout).toBe(originalSetTimeout)
  expect(timersPromises.setTimeout).toBe(originalSetTimeoutPromise)
  expect(namedSetTimeout).toBe(originalNamedSetTimeout)
  expect(namedSetTimeoutPromise).toBe(originalNamedSetTimeoutPromise)
})

test('mocks only configured Node timer imports', () => {
  const originalSetTimeout = timers.setTimeout
  const originalSetInterval = timers.setInterval
  const originalSetTimeoutPromise = timersPromises.setTimeout
  const originalSetIntervalPromise = timersPromises.setInterval

  vi.useFakeTimers({ nodeBuiltins: true, toFake: ['setTimeout'] })

  expect(timers.setTimeout).not.toBe(originalSetTimeout)
  expect(timers.setInterval).toBe(originalSetInterval)
  expect(timersPromises.setTimeout).not.toBe(originalSetTimeoutPromise)
  expect(timersPromises.setInterval).toBe(originalSetIntervalPromise)
})

test('mocks node:timers imports', () => {
  vi.useFakeTimers({ nodeBuiltins: true })
  const called: string[] = []

  timers.setTimeout(() => called.push('default'), 100)
  namedSetTimeout(() => called.push('named'), 100)
  timersNamespace.setTimeout(() => called.push('namespace'), 100)
  requiredTimers.setTimeout(() => called.push('require'), 100)

  vi.advanceTimersByTime(100)
  expect(called).toEqual(['default', 'named', 'namespace', 'require'])
})

test('mocks node:timers/promises imports', async () => {
  vi.useFakeTimers({ nodeBuiltins: true })
  const resolved: string[] = []
  const controller = new AbortController()

  const promises = [
    timersPromises.setTimeout(10_000, undefined, { signal: controller.signal }).then(
      () => resolved.push('default'),
      () => {},
    ),
    namedSetTimeoutPromise(10_000, undefined, { signal: controller.signal }).then(
      () => resolved.push('named'),
      () => {},
    ),
    timersPromisesNamespace.setTimeout(10_000, undefined, { signal: controller.signal }).then(
      () => resolved.push('namespace'),
      () => {},
    ),
    requiredTimersPromises.setTimeout(10_000, undefined, { signal: controller.signal }).then(
      () => resolved.push('require'),
      () => {},
    ),
  ]

  try {
    await vi.advanceTimersByTimeAsync(10_000)
    expect(resolved).toEqual(['default', 'named', 'namespace', 'require'])
  }
  finally {
    controller.abort()
    await Promise.all(promises)
  }
})

test('restores Node timer imports', () => {
  const originalSetTimeout = timers.setTimeout
  const originalSetTimeoutPromise = timersPromises.setTimeout
  const originalNamedSetTimeout = namedSetTimeout
  const originalNamedSetTimeoutPromise = namedSetTimeoutPromise

  vi.useFakeTimers({ nodeBuiltins: true })
  expect(timers.setTimeout).not.toBe(originalSetTimeout)
  expect(timersPromises.setTimeout).not.toBe(originalSetTimeoutPromise)
  expect(namedSetTimeout).not.toBe(originalNamedSetTimeout)
  expect(namedSetTimeoutPromise).not.toBe(originalNamedSetTimeoutPromise)

  vi.useRealTimers()
  expect(timers.setTimeout).toBe(originalSetTimeout)
  expect(timersPromises.setTimeout).toBe(originalSetTimeoutPromise)
  expect(namedSetTimeout).toBe(originalNamedSetTimeout)
  expect(namedSetTimeoutPromise).toBe(originalNamedSetTimeoutPromise)
})
