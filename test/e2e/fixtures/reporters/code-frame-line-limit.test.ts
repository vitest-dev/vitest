import { test, expect } from "vitest"

test("basic", () => {
  // line length is 85 but highlight makes this line 245 chars
  expect([{ prop: 7 }, { prop: 7 }, { prop: 7 }, { prop: 7 }]).toBe([{ another: 8 }])
})
