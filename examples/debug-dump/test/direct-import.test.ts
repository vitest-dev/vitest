import { describe, expect, test } from 'vitest'
// Direct import - only transforms what's needed
import { formatCurrency } from '../src/utils/currency'

describe('currency formatter (direct import)', () => {
  test('formats currency correctly', () => {
    expect(formatCurrency(42.5)).toBe('$42.50')
    expect(formatCurrency(100)).toBe('$100.00')
  })
})
