import { expect, test } from 'vitest'
import { calculate } from '../src/ignore-node'

test('cover some lines', () => {
  expect(calculate(2, 1)).toBe(3)
})
