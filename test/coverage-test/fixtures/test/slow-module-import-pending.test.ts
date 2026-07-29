import { expect, test } from "vitest";

process.env.DELAY = "10000";

test("module import pending", async () => {
  const promise = import("../src/slow-module-imported");

  await new Promise((resolve) => setTimeout(resolve, 10));

  expect(promise).toBeTruthy();
});
