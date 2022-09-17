import { expect, it, vi } from 'vitest'
import { foo } from '../src'

vi.mock('../src.ts', () => ({ foo: 'baz' }))

it('should work', () => {
  expect(1).toBe(1)
})

it('mocking with root works', () => {
  expect(foo).toBe('baz')
})
