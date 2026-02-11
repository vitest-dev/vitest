import { expect, test, vi } from 'vitest'
import { testConst } from './module.js'

vi.mock('./module.ts', () => ({ testConst: 20 }))

test('can mock modules when vi.mock caller is inside a directory with spaces', () => {
  expect(testConst).toBe(20)
})
