import { describe, expect, it } from 'vitest'

let count1 = 0
it('retry test', () => {
  count1 += 1
  expect(count1).toBe(3)
}, { retry: 2 })

let count2 = 0
it.fails('retry test fails', () => {
  count2 += 1
  expect(count2).toBe(3)
}, { retry: 1 })

let count3 = 0
it('retry test fails', () => {
  count3 += 1
  expect(count3).toBe(3)
}, { retry: 10 })

it('result', () => {
  expect(count1).toEqual(3)
  expect(count2).toEqual(2)
  expect(count3).toEqual(3)
})

describe('description retry', () => {
  let count4 = 0
  let count5 = 0
  it('test should inherit options from the description block if missing', () => {
    count4 += 1
    expect(count4).toBe(2)
  })

  it('test should not inherit options from the description block if exists', () => {
    count5 += 1
    expect(count5).toBe(5)
  }, { retry: 5 })
}, { retry: 2 })

describe.each([
  { a: 1, b: 1, expected: 2 },
  { a: 1, b: 2, expected: 3 },
  { a: 2, b: 1, expected: 3 },
])('describe object add($a, $b)', ({ a, b, expected }) => {
  let flag1 = false
  let flag2 = false
  let flag3 = false
  it(`returns ${expected}`, () => {
    flag1 = !flag1
    expect(a + b).toBe(expected)
    expect(flag1).toBe(false)
  })

  it(`returned value not be greater than ${expected}`, () => {
    flag2 = !flag2
    expect(a + b).not.toBeGreaterThan(expected)
    expect(flag2).toBe(false)
  })

  it(`returned value not be less than ${expected}`, () => {
    flag3 = !flag3
    expect(a + b).not.toBeLessThan(expected)
    expect(flag3).toBe(false)
  })
}, { retry: 2 })
