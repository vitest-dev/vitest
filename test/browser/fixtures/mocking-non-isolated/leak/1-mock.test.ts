import { expect, test, vi } from 'vitest'
import { leak } from '../src/leak'

vi.mock('../src/leak', () => ({ leak: () => 'mocked' }))

test('the mock is imported first', () => {
  expect(leak()).toBe('mocked')
})
