import { it, expect } from "vitest";

console.log('basic')

it("basic", async () => {
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  await sleep(2000)
  expect(globalThis.performance).toBeDefined();
});

it("basic 2", () => {
  expect(globalThis.window).toBeDefined();
  expect(globalThis.window).toBe(undefined);
});
