import { expect, test, vi } from 'vitest'

vi.mock('./path')

test('failed', () => {
  expect(1).toBe(2)
})
