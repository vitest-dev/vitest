import { vi, test, expect } from "vitest"
import lib from "./lib.js";

vi.mock("./lib.js", () => ({ default: "mocked" }))

test("project1 imported", () => {
  expect(lib).toBe("mocked");
})
