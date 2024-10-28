import { describe, expect, test, vi } from 'vitest'
import zustand from 'zustand'
import { magic } from '../../src/mocks/zustand-magic'

vi.mock('zustand')

describe('zustand didn\'t go into an infinite loop', () => {
  test('zustand is mocked', () => {
    expect(vi.isMockFunction(zustand)).toBe(true)
  })

  test('magic calls zustand', () => {
    const store = magic()
    expect(zustand).toHaveBeenCalled()
    expect(store).toBeTypeOf('function')
  })
})
