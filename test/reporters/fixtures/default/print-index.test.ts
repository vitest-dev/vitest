import { describe, expect, test } from "vitest";

describe('passed', () => {
  test.each([4, 5, 6])('0-based index of the test case is %#', (d) => {
    expect(d).toBe(d)
  })

  test.each([4, 5, 6])('1-based index of the test case is %$', (d) => {
    expect(d).toBe(d)
  })
})
