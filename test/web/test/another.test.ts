import { it, expect } from "vitest";

console.log('another')

it("basic 3", async () => {
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  await sleep(2000)
  expect(globalThis.window).toBeDefined();
});
