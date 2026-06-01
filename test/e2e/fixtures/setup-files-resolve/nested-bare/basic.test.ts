import { test, expect } from "vitest";

test("basic", () => {
  expect((globalThis as any).__testSetupResolve).toBe("ok");
});
