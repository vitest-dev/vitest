import { expect, test } from "vitest"

test("cover lines", async () => {
  const mod = await import("../src/tested-with-]-in-filename")

  expect(mod.default(100, 2)).toBe(102)
})
