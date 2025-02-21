import { describe, expect, test } from "vitest"

console.log("Log from failed file")

test("passing test #1", () => {
  console.log("Log from passed test")
})

test("failing test #1", () => {
  console.log("Log from failed test")
  expect(1).toBe(2)
})

describe("failing suite", () => {
  test("passing test #2", () => {
    console.log("Log from passed test")
  })

  test("failing test #2", () => {
    console.log("Log from failed test")
    expect(2).toBe(3)
  })
})

