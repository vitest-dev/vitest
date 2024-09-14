import { test, expect } from "vitest"

test('multiple errors', () => {
  expect(new Promise((r) => r("xx"))).resolves.toBe("yy");
  expect(new Promise((r) => setTimeout(() => r("xx"), 10))).resolves.toBe("zz");
})
