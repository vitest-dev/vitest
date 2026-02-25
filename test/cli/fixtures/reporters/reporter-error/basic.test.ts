import { expect, test } from 'vitest'

test('reports a passing test', () => {
  console.log('reporter-error-log')
  expect(1).toBe(1)
})
