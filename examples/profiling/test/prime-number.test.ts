import { expect, test } from 'vitest'
import getPrimeNumber from '../src/prime-number'

const BITS = process.env.CI ? 8 : 62

test('generate prime number', () => {
  const prime = getPrimeNumber(BITS)

  expect(prime).toBeGreaterThanOrEqual(0)
  expect(prime).toBeLessThanOrEqual(2 ** BITS)
})
