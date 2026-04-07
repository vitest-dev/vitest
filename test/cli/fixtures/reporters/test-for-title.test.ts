import { expect, test } from "vitest"

test.for([
  { 0: 'a', 1: {}, 2: { te: "st" } },
  { "0": 'b', "1": [], "2": ["test"] },
])('test.for object : 0 = $0, 2 = $2', () => {});

test.each([
  { 0: 'a', 1: {}, 2: { te: "st" } },
  { "0": 'b', "1": [], "2": ["test"] },
])('test.each object : 0 = $0, 2 = $2 ', () => {});

test.for([
  ['a', {}, { te: "st" }],
  ['b', [], [ "test" ]],
])('test.for array : 0 = $0, 2 = $2', () => {});

test.each([
  ['a', {}, { te: "st" }],
  ['b', [], [ "test" ]],
])('test.each array : 0 = $0, 2 = $2', () => {});

test.each([
  { a: 1, b: 1, expected: 2 },
  { a: 1, b: 2, expected: 3 },
  { a: 2, b: 1, expected: 3 },
])('object : add($a, $b) -> $expected', ({ a, b, expected }) => {
  expect(a + b).toBe(expected)
})

test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('array : add($0, $1) -> $2', (a, b, expected) => {
  expect(a + b).toBe(expected)
})

test.for([
  [{ k1: "v1" }, { k2: "v2" }],
])('first array element is object: 0 = $0, 1 = $1, k1 = $k1, k2 = $k2', () => {})

test.for([
  ["foo", "bar"],
])('first array element is not object: 0 = $0, 1 = $1, k = $k', () => {})

test.for([
  { k: "v1" },
  { k: "v2" },
])('not array: 0 = $0, 1 = $1, k = $k', () => {})


test.each([[343434, "$343,434.00"]])(
  "handles whole numbers: %s as %s",
  (input, expected) => {
    expect(
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(input),
    ).toBe(expected);
  },
);

test.each([{ a: "$b", b: "yay" }])("%o", () => {});
test.each([{ a: "%o" }])("$a", () => {});
test.each([{ a: "%o" }])("%o", () => {});
test.each([{ a: "%o" }])("$a %o", () => {});
test.each([{ a: "%o" }])("%o $a", () => {});
