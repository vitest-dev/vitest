import { expect, test } from "vitest";

// not merged
test.for([1, 2])("test-a %$", (n) => {
  expect(n).toBe(0);
});

// merged
test.for([1, 2])("test-b %$", (n) => {
  expect(1).toBe(0);
});

// not merged
test.each([
  {
    actual: ["a".repeat(50)],
    expected: ["b".repeat(50)],
  },
  {
    actual: ["c".repeat(50)],
    expected: ["d".repeat(50)],
  },
])("test-c %$", async ({ actual, expected }) => {
  expect(actual).toEqual(expect.arrayContaining(expected));
});
