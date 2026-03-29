import { test , expect } from "vitest"
import { runFork } from "../src/start-fork-and-thread";

test("child process typescript", async () => {
  const result = await runFork();
  expect(result).toBe(5);
})

test.todo("child process javascript source file")
test.todo("child process transpiled javascript with source maps")
