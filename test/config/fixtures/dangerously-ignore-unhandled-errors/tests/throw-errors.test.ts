import { test } from "vitest"

test("Some test", () => {
  //
})

new Promise((_, reject) => reject(new Error("intentional unhandled error")))