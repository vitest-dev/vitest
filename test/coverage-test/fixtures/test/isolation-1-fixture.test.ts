import { test } from "vitest";
import { multiply, remainder, subtract, sum } from "../src/math";

test("Should run function sucessfully", async () => {
  sum(1, 1);
  subtract(1,2)
  multiply(3,4)
  remainder(6,7)
});
