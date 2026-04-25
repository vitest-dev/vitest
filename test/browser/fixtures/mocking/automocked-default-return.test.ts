import { expect, test, vi } from 'vitest'
import { calculator } from './src/calculator'

vi.mock('./src/calculator')

test('returns undefined without mock implementation', () => {
  expect(calculator('plus', 1, 2)).toBeUndefined()
})
