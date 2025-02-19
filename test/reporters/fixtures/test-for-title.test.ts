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
