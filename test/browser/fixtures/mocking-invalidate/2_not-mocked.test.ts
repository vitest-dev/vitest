import { expect, test } from 'vitest'
import { add } from './src/math'

test('add is not mocked after previous file invalidated its mocks', () => {
  expect(add(1, 2)).toBe(3)
})
