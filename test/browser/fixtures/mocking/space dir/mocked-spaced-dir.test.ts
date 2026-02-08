import { expect, test, vi } from 'vitest'
import { testConst } from './module.js'

vi.mock('./module.ts', () => ({ testConst: 20 }))

test('module with space in directory path is mocked', () => {
  expect(testConst).toBe(20)
})
