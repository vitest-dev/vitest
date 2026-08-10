// @vitest-environment node

import { createRequire } from 'node:module'
import timers, { setTimeout as namedSetTimeout } from 'node:timers'
import * as timersNamespace from 'node:timers'
import timersPromises, { setTimeout as namedSetTimeoutPromise } from 'node:timers/promises'
import * as timersPromisesNamespace from 'node:timers/promises'
import { afterEach, expect, test, vi } from 'vitest'
import './fixtures/timers.suite'

const require = createRequire(import.meta.url)

afterEach(() => {
  vi.useRealTimers()
})

test('mocks node:timers default and require imports', () => {
  vi.useFakeTimers()
  const called: string[] = []

  timers.setTimeout(() => called.push('default'), 100)
  require('node:timers').setTimeout(() => called.push('require'), 100)

  vi.advanceTimersByTime(100)
  expect(called).toEqual(['default', 'require'])
})

test('mocks node:timers/promises default and require imports', async () => {
  vi.useFakeTimers()
  const resolved: string[] = []

  const promises = [
    timersPromises.setTimeout(100).then(() => resolved.push('default')),
    require('node:timers/promises').setTimeout(100).then(() => resolved.push('require')),
  ]

  await vi.advanceTimersByTimeAsync(100)
  await Promise.all(promises)
  expect(resolved).toEqual(['default', 'require'])
})

test('restores node timer imports', () => {
  const originalSetTimeout = timers.setTimeout
  const originalSetTimeoutPromise = timersPromises.setTimeout

  vi.useFakeTimers()
  expect(timers.setTimeout).not.toBe(originalSetTimeout)
  expect(timersPromises.setTimeout).not.toBe(originalSetTimeoutPromise)

  vi.useRealTimers()
  expect(timers.setTimeout).toBe(originalSetTimeout)
  expect(timersPromises.setTimeout).toBe(originalSetTimeoutPromise)
})

test.skipIf(import.meta.env.VITEST_VM_POOL)('mocks named Node timer imports', async () => {
  vi.useFakeTimers()
  const called: string[] = []

  namedSetTimeout(() => called.push('named'), 100)
  timersNamespace.setTimeout(() => called.push('namespace'), 100)
  const promises = [
    namedSetTimeoutPromise(100).then(() => called.push('promises named')),
    timersPromisesNamespace.setTimeout(100).then(() => called.push('promises namespace')),
  ]

  await vi.advanceTimersByTimeAsync(100)
  await Promise.all(promises)
  expect(called).toEqual([
    'named',
    'namespace',
    'promises named',
    'promises namespace',
  ])
})

test.skipIf(import.meta.env.VITEST_VM_POOL)('restores named Node timer imports', () => {
  const originalNamedSetTimeout = namedSetTimeout
  const originalNamedSetTimeoutPromise = namedSetTimeoutPromise

  vi.useFakeTimers()
  expect(namedSetTimeout).not.toBe(originalNamedSetTimeout)
  expect(namedSetTimeoutPromise).not.toBe(originalNamedSetTimeoutPromise)

  vi.useRealTimers()
  expect(namedSetTimeout).toBe(originalNamedSetTimeout)
  expect(namedSetTimeoutPromise).toBe(originalNamedSetTimeoutPromise)
})
