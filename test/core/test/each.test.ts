import { describe, expect, test } from 'vitest'

test.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('add(%i, %i) -> %i', (a, b, expected) => {
  expect(a + b).toBe(expected)
})

test.each([
  ['string', true],
  ['string', false],
])('can be parsed', (a, b) => {
  const typedA: string = a
  const typedB: boolean = b

  expect(typedA).toBeDefined()
  expect(typedB).toBeDefined()
})

describe.each([
  [1, 1, 2],
  [1, 2, 3],
  [2, 1, 3],
])('describe add(%i, %i)', (a, b, expected) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected)
  })

  test(`returned value not be greater than ${expected}`, () => {
    expect(a + b).not.toBeGreaterThan(expected)
  })

  test(`returned value not be less than ${expected}`, () => {
    expect(a + b).not.toBeLessThan(expected)
  })
})

describe.each([
  [1, 'a', '1a'],
  [1, 'b', '1b'],
  [2, 'c', '2c'],
] as const)('describe concatenate(%i, %s)', (a, b, expected) => {
  test(`returns ${expected}`, () => {
    // This will fail typechecking if const is not used and/or types for a,b are merged into a union
    const typedA: number = a
    const typedB: string = b

    expect(`${typedA}${typedB}`).toBe(expected)
  })
})

describe.each([
  { a: 1, b: 1, expected: 2 },
  { a: 1, b: 2, expected: 3 },
  { a: 2, b: 1, expected: 3 },
])('describe object add($a, $b)', ({ a, b, expected }) => {
  test(`returns ${expected}`, () => {
    expect(a + b).toBe(expected)
  })

  test(`returned value not be greater than ${expected}`, () => {
    expect(a + b).not.toBeGreaterThan(expected)
  })

  test(`returned value not be less than ${expected}`, () => {
    expect(a + b).not.toBeLessThan(expected)
  })
})

// issue #794
describe.each([1, 2, 0])('%s (describe.each 1d)', (num) => {
  test(`${num} is a number (describe.each 1d)`, () => {
    expect(typeof num).toEqual('number')
  })
})
