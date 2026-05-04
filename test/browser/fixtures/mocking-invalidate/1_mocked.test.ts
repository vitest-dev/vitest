import { expect, test, vi } from 'vitest'
import { add } from './src/math'

vi.mock('./src/math')

test('add is mocked in this file', () => {
  vi.mocked(add).mockReturnValue(99)
  expect(add(1, 2)).toBe(99)
})
