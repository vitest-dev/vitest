import { expect, test } from "vitest"
import type { MyContext } from "./setup"

test<MyContext>("x", (ctx) => {
  expect(ctx.testOk).toBe(true)
})
