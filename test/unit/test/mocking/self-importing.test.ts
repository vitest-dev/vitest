import fn from '@vitest/test-fn'
import { describe, expect, test, vi } from 'vitest'
import { magic } from '../../src/mocks/test-fn-magic'

vi.mock('@vitest/test-fn')

describe('fn didn\'t go into an infinite loop', () => {
  test('fn is mocked', () => {
    expect(vi.isMockFunction(fn)).toBe(true)
  })

  test('magic calls fn', () => {
    const store = magic()
    expect(fn).toHaveBeenCalled()
    expect(store).toBeTypeOf('function')
  })
})
