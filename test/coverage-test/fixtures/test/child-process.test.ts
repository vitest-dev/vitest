import { test , expect } from "vitest"
import { runFork } from "../src/start-fork-and-thread";

const isTypeStrippingSupported = !!process.features.typescript

test.runIf(isTypeStrippingSupported)("child process typescript", async () => {
  const { result } = await runFork('worker-or-process.ts');
  expect(result).toBe(5);
})

test("child process javascript source file", async () => {
  const { result } = await runFork('worker-or-process.js');
  expect(result).toBe(5);
})

test("child process transpiled javascript with source maps", async () => {
  const { result } = await runFork('worker-or-process.pre-transpiled.js');
  expect(result).toBe("finished");
})

test("child process inside child process", async () => {
  const { result } = await runFork('worker-or-process.nested.js');
  expect(result).toBe(5);
})
