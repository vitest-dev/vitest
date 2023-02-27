import { afterAll, describe, expect, test } from 'vitest'

const testNumbers: number[] = []

describe('testing it/test', () => {
  const result = [1, 1, 1, 1, 1, 2, 2, 2]
  // repeats 5 times by default
  test.repeats('test 1', () => {
    testNumbers.push(1)
  })

  test.repeats('test 2', () => {
    testNumbers.push(2)
  }, { repeats: 3 })

  test.repeats.fails('test 3', () => {
    testNumbers.push(3)
    expect(testNumbers).toStrictEqual(result)
  })

  afterAll(() => {
    result.push(3)
    expect(testNumbers).toStrictEqual(result)
  })
})

const describeNumbers: number[] = []

describe.repeats('testing describe 1', () => {
  test('test 1', () => {
    describeNumbers.push(1)
  })
})

describe.repeats('testing describe 2', () => {
  test('test 2', () => {
    describeNumbers.push(2)
  })
}, { repeats: 3 })

afterAll(() => {
  expect(describeNumbers).toStrictEqual([1, 1, 1, 1, 1, 2, 2, 2])
})
