import { test } from "vitest";

test("error serialization with toJSON", () => {
  throw Object.assign(new Error("hello"), { date: new Date(0) })
})
