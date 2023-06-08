import { describe, expect, test } from 'vitest'

describe('a passed', () => {
  test.each([1, 2, 3])('a%d test', (d) => {
    expect(d).toBe(d)
  })
  describe('nested a', () => {
    test.each([1, 2, 3])('nested a%d test', (d) => {
      expect(d).toBe(d)
    })
  })
})

describe('a failed', () => {
  test.each([1, 2, 3])('a failed %d test', (d) => {
    expect(d).toBe(d)
  })
  test('a failed test', () => {
    expect(1).toBe(2)
  })
  describe('nested a failed', () => {
    test.each([1, 2, 3])('nested a failed %d test', (d) => {
      expect(d).toBe(d)
    })
  })
})
