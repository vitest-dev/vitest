import { test , expect } from "vitest"
import { runFork } from "../src/start-fork-and-thread";

test("child process typescript", async () => {
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

