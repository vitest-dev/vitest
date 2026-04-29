import { test } from "vitest";

test("calls IPC channel", () => {
  if (!process.send) {
    throw new Error("Expected test case to run inside child_process")
  }

  process.send({ "not serialized": "with v8 serializer" })
})
