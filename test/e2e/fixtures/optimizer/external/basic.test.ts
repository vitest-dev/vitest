import { it, expect } from "vitest";
// @ts-ignore
import * as testDep from "@vitest/test-dep-optimizer-external"

it("passes", () => {
  expect(testDep.default).toBeDefined();
});
