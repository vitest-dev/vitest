import { test, expect } from "vitest";

test("", () => {
  expect({foo: {
    a: 1,
    b: 2
  }}).toMatchInlineSnapshot(`
    Pretty foo: {
      "a": 1,
      "b": 2,
    }
  `);

  expect({bar: {
    a: 1,
    b: 2
  }}).toMatchInlineSnapshot(`
    Pretty bar: {
      "a": 1,
      "b": 2,
    }
  `);
})
