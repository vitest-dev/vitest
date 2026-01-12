import { describe, expect, test } from 'vitest'

describe('b1 passed', () => {
  test.each([1, 2, 3])('b%d test', (d) => {
    expect(d).toBe(d)
  })
  describe('nested b', () => {
    test.each([1, 2, 3])('nested b%d test', (d) => {
      expect(d).toBe(d)
    })
  })
})

describe('b1 failed', () => {
  test.each([1, 2, 3])('b%d test', (d) => {
    expect(d).toBe(d)
  })
  test('b failed test', () => {
    expect(1).toBe(2)
  })
  describe('nested b', () => {
    test.each([1, 2, 3])('nested b%d test', (d) => {
      expect(d).toBe(d)
    })
  })
})
