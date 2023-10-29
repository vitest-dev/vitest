// @vitest-environment node

import { expect, test } from 'vitest'
import { sum } from '../src/multi-environment'

test('runs on server', () => {
  expect(sum(2, 2)).toBe(4)
  expect(sum(100, 200)).toBe(300)
})
