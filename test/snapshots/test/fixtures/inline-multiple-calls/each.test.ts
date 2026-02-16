import { expect, test, describe } from "vitest";

test.for(["hello", "world"])("test %s", (arg) => {
  expect(arg.length).toMatchInlineSnapshot(`5`);
});

describe.for(["hello", "world"])("suite %s", (arg) => {
  test("length", () => {
    expect(arg.length).toMatchInlineSnapshot(`5`);
  });
});

test.for(["hello", "world"])("toThrowErrorMatchingInlineSnapshot %s", (arg) => {
  expect(() => {
    throw new Error(`length = ${arg.length}`);
  }).toThrowErrorMatchingInlineSnapshot(`[Error: length = 5]`)
});
