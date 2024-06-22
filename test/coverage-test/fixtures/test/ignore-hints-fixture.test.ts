import { test, expect} from "vitest";
import { first, second } from '../src/ignore-hints';

test("cover some lines", () => {
  expect(first()).toBe("First")
  expect(second()).toBe("Second")
})