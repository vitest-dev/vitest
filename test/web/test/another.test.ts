import { it as _it, expect } from "vitest";

const it = typeof window === "undefined" ? _it.skip : _it;

it("basic 3", async () => {
  expect(globalThis.window).toBeDefined();
});
