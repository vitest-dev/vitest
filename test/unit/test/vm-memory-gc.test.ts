import { afterEach, describe, expect, it, vi } from 'vitest'
import { getUsedMemory } from '../../../packages/vitest/src/runtime/workers/init'

describe('vm worker getUsedMemory', () => {
  const originalGc = globalThis.gc

  afterEach(() => {
    if (originalGc === undefined) {
      delete (globalThis as any).gc
    } else {
      globalThis.gc = originalGc
    }
  })

  it('returns undefined when reportMemory is false', () => {
    const getHeap = vi.fn(() => 200)
    expect(getUsedMemory(false, 100, getHeap)).toBeUndefined()
    expect(getHeap).not.toHaveBeenCalled()
  })

  it('skips gc when heapUsed is below memoryLimit', () => {
    const gcSpy = vi.fn()
    globalThis.gc = gcSpy
    const getHeap = vi.fn(() => 50)

    expect(getUsedMemory(true, 100, getHeap)).toBe(50)
    expect(gcSpy).not.toHaveBeenCalled()
    expect(getHeap).toHaveBeenCalledTimes(1)
  })

  it('runs gc and re-measures heapUsed when heapUsed reaches memoryLimit', () => {
    let heap = 150
    const gcSpy = vi.fn(() => {
      heap = 40
    })
    globalThis.gc = gcSpy

    expect(getUsedMemory(true, 100, () => heap)).toBe(40)
    expect(gcSpy).toHaveBeenCalledTimes(1)
  })
})
