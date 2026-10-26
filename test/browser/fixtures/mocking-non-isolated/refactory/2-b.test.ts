import { expect, test, vi } from 'vitest'
import { refactory } from '../src/refactory'

vi.mock('../src/refactory', () => ({ refactory: () => 'b' }))

test('a second factory for the same module', () => {
  expect(refactory()).toBe('b')
})
