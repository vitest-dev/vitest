import { test } from "vitest";
import { assertHelper, assertHelperAsync, assertHelperBad } from "./helper.js";

test("sync", async () => {
  assertHelper(3, 4);
});

test("async", async () => {
  await assertHelperAsync(3, 4)
})

test("bad", () => {
  assertHelperBad(3, 4)
})
