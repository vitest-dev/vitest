import { test, expect } from "vitest"

test("basic", () => {
  expect("ok").toMatchSnapshot()
})
