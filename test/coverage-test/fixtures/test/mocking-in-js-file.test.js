import { expect, test, vi } from 'vitest'
import { add } from '../src/math'

vi.mock('../src/math', async () => ({
  add: vi.fn().mockReturnValue('mocked'),
}))

test('mocking in Javascript test should not break sourcemaps', () => {
  expect(add(1, 2)).toBe('mocked')
})
