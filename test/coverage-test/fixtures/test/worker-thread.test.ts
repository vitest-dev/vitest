import { test , expect } from "vitest"
import { runThread } from "../src/start-fork-and-thread";

test("worker thread", async () => {
  const result = await runThread();
  expect(result).toBe(5);
})
