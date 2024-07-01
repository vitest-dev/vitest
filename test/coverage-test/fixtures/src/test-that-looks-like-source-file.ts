import { test, expect } from 'vitest'
import { sum } from "./math"

test("run tests on file that looks like source file", () => {
  expect(sum(1,2)).toBe(3)
})