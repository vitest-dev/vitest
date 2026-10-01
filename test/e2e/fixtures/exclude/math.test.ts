import { expect, test } from 'vitest'

import { add } from './math'

test('should add two numbers correctly', () => {
  expect(add(1, 2)).toBe(3)
})
