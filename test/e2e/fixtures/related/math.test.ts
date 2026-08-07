import { expect, test } from 'vitest'

import { sum } from './math'

test('sum', () => {
  expect(sum(1, 2)).toBe(3)
})
