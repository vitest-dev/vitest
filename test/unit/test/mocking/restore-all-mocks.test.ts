import { describe, expect, test, vi } from 'vitest'

describe('restoreAllMocks error handling and cleanup', () => {
  test('single restoration failure restores other spies and clears registry', () => {
    const target1 = { fn: () => 'target1' }
    const target2 = { fn: () => 'target2' }

    vi.spyOn(target1, 'fn')
    Object.freeze(target1)

    vi.spyOn(target2, 'fn')

    let thrownError: unknown
    try {
      vi.restoreAllMocks()
    } catch (err) {
      thrownError = err
    }

    // 1. The failing restoration error is thrown
    expect(thrownError).toBeInstanceOf(TypeError)
    expect((thrownError as TypeError).message).toBe('Cannot redefine property: fn')

    // 2. Subsequent spies were still restored
    expect(vi.isMockFunction(target2.fn)).toBe(false)
    expect(target2.fn()).toBe('target2')

    // 3. Calling restoreAllMocks again does not throw
    expect(() => vi.restoreAllMocks()).not.toThrow()
  })

  test('multiple restoration failures throw AggregateError and retain underlying errors', () => {
    const target1 = { fn: () => 'target1' }
    const target2 = { fn: () => 'target2' }
    const target3 = { fn: () => 'target3' }

    vi.spyOn(target1, 'fn')
    Object.freeze(target1)

    vi.spyOn(target2, 'fn')

    vi.spyOn(target3, 'fn')
    Object.freeze(target3)

    let thrownError: unknown
    try {
      vi.restoreAllMocks()
    } catch (err) {
      thrownError = err
    }

    // 1. AggregateError is thrown when multiple restorations fail
    expect(thrownError).toBeInstanceOf(AggregateError)
    const aggregate = thrownError as AggregateError
    expect(aggregate.message).toBe('Some mocks could not be restored')
    expect(aggregate.errors).toHaveLength(2)
    expect(aggregate.errors[0]).toBeInstanceOf(TypeError)
    expect(aggregate.errors[1]).toBeInstanceOf(TypeError)

    // 2. Spies that could be restored were restored
    expect(vi.isMockFunction(target2.fn)).toBe(false)
    expect(target2.fn()).toBe('target2')

    // 3. Calling restoreAllMocks again does not throw
    expect(() => vi.restoreAllMocks()).not.toThrow()
  })

  test('successful restorations do not throw', () => {
    const target1 = { fn: () => 'target1' }
    const target2 = { fn: () => 'target2' }

    vi.spyOn(target1, 'fn')
    vi.spyOn(target2, 'fn')

    expect(() => vi.restoreAllMocks()).not.toThrow()
    expect(vi.isMockFunction(target1.fn)).toBe(false)
    expect(vi.isMockFunction(target2.fn)).toBe(false)
  })

  test('subsequent cleanup allows restoring newly registered spies', () => {
    const target1 = { fn: () => 'target1' }
    vi.spyOn(target1, 'fn')
    Object.freeze(target1)

    expect(() => vi.restoreAllMocks()).toThrow()

    // New spy registered after failed restoreAllMocks
    const target2 = { fn: () => 'target2' }
    vi.spyOn(target2, 'fn')

    expect(() => vi.restoreAllMocks()).not.toThrow()
    expect(vi.isMockFunction(target2.fn)).toBe(false)
    expect(target2.fn()).toBe('target2')
  })
})
