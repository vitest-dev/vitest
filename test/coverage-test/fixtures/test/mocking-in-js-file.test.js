import { expect, test, vi } from 'vitest'
import { sum } from '../src/math'

vi.mock('../src/math', async () => ({
  sum: vi.fn().mockReturnValue('mocked'),
}))

test('mocking in Javascript test should not break sourcemaps', () => {
  expect(sum(1, 2)).toBe('mocked')
})
