import { expect, test } from "vitest";

test("file", () => {
  expect({ name: "alice", age: 30 }).toMatchSnapshot({ age: expect.any(Number) });
});

test("file asymmetric", () => {
  expect({ name: "bob", score: 95 }).toMatchSnapshot({
    score: expect.toSatisfy(function lessThan100(n) {
      return n < 100;
    }),
  });
});

test("file snapshot-only", () => {
  expect({ name: "dave", age: 42 }).toMatchSnapshot({ age: expect.any(Number) });
});

// -- TEST INLINE START --
test("inline", () => {
  expect({ name: "carol", age: 25 }).toMatchInlineSnapshot({ age: expect.any(Number) }, `
    Object {
      "age": Any<Number>,
      "name": "carol",
    }
  `);
});
// -- TEST INLINE END --
