// @vitest-environment node

import { createRequire } from 'node:module'
import timers, { setTimeout as nodeSetTimeout } from 'node:timers'
import { setTimeout as nodePromisesSetTimeout } from 'node:timers/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'

import './fixtures/timers.suite'

const require = createRequire(import.meta.url)

describe('node:timers mocking', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mocks node:timers setTimeout', () => {
    vi.useFakeTimers()
    const spy = vi.fn()
    nodeSetTimeout(spy, 100)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalled()
  })

  it('mocks default and namespace imports of node:timers', async () => {
    vi.useFakeTimers()
    const spy1 = vi.fn()
    timers.setTimeout(spy1, 100)
    vi.advanceTimersByTime(100)
    expect(spy1).toHaveBeenCalled()

    const spy2 = vi.fn()
    const timersNamespace = await import('node:timers')
    timersNamespace.setTimeout(spy2, 100)
    vi.advanceTimersByTime(100)
    expect(spy2).toHaveBeenCalled()
  })

  it('mocks node:timers/promises setTimeout', async () => {
    vi.useFakeTimers()
    let called = false
    const promise = nodePromisesSetTimeout(5000).then(() => {
      called = true
    })
    await vi.advanceTimersByTimeAsync(5000)
    expect(called).toBe(true)
    await promise
  })

  it('mocks setTimeout required via node:timers', () => {
    vi.useFakeTimers()
    const spy = vi.fn()
    require('node:timers').setTimeout(spy, 100)
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalled()
  })

  it('restores real timers with useRealTimers', () => {
    const realSetTimeout = require('node:timers').setTimeout
    vi.useFakeTimers()
    vi.useRealTimers()
    expect(require('node:timers').setTimeout).toBe(realSetTimeout)
  })
})
