import { afterAll, describe, expect, test } from 'vitest'

const numbers: number[] = []

test.for([1, 2, 3, 4, 5])('test %s', (v) => {
  numbers.push(10 + v)
})

describe("inherit shuffle", () => {
  test.for([1, 2, 3, 4, 5])('test %s', (v) => {
    numbers.push(20 + v)
  })
})

describe('unshuffle', { shuffle: false }, () => {
  test.for([1, 2, 3, 4, 5])('test %s', (v) => {
    numbers.push(30 + v)
  })
})

afterAll(() => {
  expect(numbers).toEqual([
    11, 14, 13, 15, 12,
    31, 32, 33, 34, 35,
    21, 24, 23, 25, 22
  ])
})
