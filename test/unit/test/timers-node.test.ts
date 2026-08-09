// @vitest-environment node

import { createRequire } from 'node:module'
import timersNamespace, { setTimeout as namedSetTimeout } from 'node:timers'
import { setTimeout as promisesSetTimeout } from 'node:timers/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'

import './fixtures/timers.suite'

const require = createRequire(import.meta.url)

describe('node:timers mocking', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not invoke a node:timers named-import setTimeout callback until fake time advances', () => {
    vi.useFakeTimers()
    const callback = vi.fn()

    namedSetTimeout(callback, 100)

    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not invoke a node:timers default-import setTimeout callback until fake time advances', () => {
    vi.useFakeTimers()
    const callback = vi.fn()

    timersNamespace.setTimeout(callback, 100)

    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not invoke a dynamically namespace-imported node:timers setTimeout callback until fake time advances', async () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const timers = await import('node:timers')

    timers.setTimeout(callback, 100)

    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not resolve a node:timers/promises setTimeout until fake time advances', async () => {
    vi.useFakeTimers()
    let resolved = false

    const promise = promisesSetTimeout(5000).then(() => {
      resolved = true
    })

    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(resolved).toBe(true)

    await promise
  })

  it('does not invoke a require("node:timers") setTimeout callback until fake time advances', () => {
    vi.useFakeTimers()
    const callback = vi.fn()

    require('node:timers').setTimeout(callback, 100)

    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('restores the original node:timers setTimeout once real timers are restored', () => {
    const realSetTimeout = require('node:timers').setTimeout

    vi.useFakeTimers()
    expect(require('node:timers').setTimeout).not.toBe(realSetTimeout)

    vi.useRealTimers()
    expect(require('node:timers').setTimeout).toBe(realSetTimeout)
  })
})
