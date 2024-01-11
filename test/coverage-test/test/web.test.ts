// @vitest-environment jsdom

import { expect, test } from 'vitest'
import { sum } from '../src/multi-environment'

test('runs on client', () => {
  expect(sum(1, 2)).toBe(3)
  expect(sum(10, 23)).toBe(33)
})
