import { expect, test, vi } from 'vitest'
import { refactory } from '../src/refactory'

vi.mock('../src/refactory', () => ({ refactory: () => 'a' }))

test('the first factory', () => {
  expect(refactory()).toBe('a')
})
