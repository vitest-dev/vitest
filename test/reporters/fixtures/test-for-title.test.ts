import { test } from "vitest"

test.for([
  { 0: 'a', 1: {}, 2: { te: "st" } },
  { "0": 'b', "1": [], "2": ["test"] },
])('test.for object (0 = $0, 2 = $2)', () => {});

test.each([
  { 0: 'a', 1: {}, 2: { te: "st" } },
  { "0": 'b', "1": [], "2": ["test"] },
])('test.each object (0 = $0, 2 = $2)', () => {});

test.for([
  ['a', {}, { te: "st" }],
  ['b', [], [ "test" ]],
])('test.for array (0 = $0, 2 = $2)', () => {});

test.each([
  ['a', {}, { te: "st" }],
  ['b', [], [ "test" ]],
])('test.each array (0 = $0, 2 = $2)', () => {});
