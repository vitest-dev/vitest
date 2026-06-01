import { test , expect } from "vitest"
import { runThread } from "../src/start-fork-and-thread";

const isTypeStrippingSupported = !!process.features.typescript

test.runIf(isTypeStrippingSupported)("worker thread typescript", async () => {
  const { result } = await runThread('worker-or-process.ts');
  expect(result).toBe(5);
})

test("worker thread javascript source file", async () => {
  const { result } = await runThread('worker-or-process.js');
  expect(result).toBe(5);
})

test("worker thread transpiled javascript with source maps", async () => {
  const { result } = await runThread('worker-or-process.pre-transpiled.js');
  expect(result).toBe("finished");
})

test("worker thread inside worker thread", async () => {
  const { result } = await runThread('worker-or-process.nested.js', );
  expect(result).toBe(5);
})
