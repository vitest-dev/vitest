import { expect, test } from 'vitest'

import { add } from './add.js'

test('adds two numbers', () => {
  const result = add(2, 3)
  expect(result).toBe(5)
})
test('fails adding two numbers', () => {
  const result = add(2, 3)
  expect(result).toBe(6)
})

// test("adds two numbers 1", async () => {
//   const result = add(2, 3);
//   await sleep(1000);
//   expect(result).toBe(5);
// });

// const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
