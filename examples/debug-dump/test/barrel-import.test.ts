import { describe, expect, test } from 'vitest'
// Importing from barrel file - causes unnecessary transformations
import { formatCurrency } from '../src/utils'

describe('currency formatter (barrel import)', () => {
  test('formats currency correctly', () => {
    expect(formatCurrency(42.5)).toBe('$42.50')
    expect(formatCurrency(100)).toBe('$100.00')
  })
})
