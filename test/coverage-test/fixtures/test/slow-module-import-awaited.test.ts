import { expect, test } from "vitest";
import { covered } from "../src/slow-module-imported";

test("covers covered()", () => {
  expect(covered(2)).toBe(102);
});
