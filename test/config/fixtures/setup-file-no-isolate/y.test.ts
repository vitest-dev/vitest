import { expect, test } from "vitest"
import type { MyContext } from "./setup"

test<MyContext>("y", (ctx) => {
  expect(ctx.testOk).toBe(true)
})
