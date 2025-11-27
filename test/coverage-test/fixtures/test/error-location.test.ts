import { test } from "vitest"
import { throwsError } from "../src/throws-error"

test("throws error", async () => {
  throwsError(true)
})
