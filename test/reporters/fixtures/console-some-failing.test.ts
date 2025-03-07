import { beforeAll, describe, expect, test } from "vitest"

console.log("Log from failed file")

test("passed test #1", () => {
  console.log("Log from passed test")
})

test("failed test #1", () => {
  console.log("Log from failed test")
  expect(1).toBe(2)
})

describe("failed suite #1", () => {
  beforeAll(() => {
    console.log("Log from failed suite")
  })

  test("passed test #2", () => {
    console.log("Log from passed test")
  })

  test("failed test #2", () => {
    console.log("Log from failed test")
    expect(2).toBe(3)
  })
})

describe("passed suite #2", () => {
  beforeAll(() => {
    console.log("Log from passed suite")
  })

  test("passed test #3", () => {
    console.log("Log from passed test")
  })
})
