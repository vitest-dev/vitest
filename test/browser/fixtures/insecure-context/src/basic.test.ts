import { expect, test } from "vitest";

test("basic", async () => {
  expect(window.isSecureContext).toBe(false);
  expect(1).toBe((await import("./dynamic-import")).default);
});
