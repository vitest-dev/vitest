import { expect, test, vi } from 'vitest'
import { foo } from '../src'

vi.mock('../src', () => ({
  foo: 'baz',
}))

test('module is mocked', () => {
  expect(foo).toBe('baz')
})
