import { afterAll, describe, expect, test } from 'vitest'

const testNumbers: number[] = []

describe('testing it/test', () => {
  const result = [1, 1, 1, 1, 1, 2, 2, 2]

  test('test 1', () => {
    testNumbers.push(1)
  }, { repeats: 4 })

  test('test 2', () => {
    testNumbers.push(2)
  }, { repeats: 2 })

  test.fails('test 3', () => {
    testNumbers.push(3)
    expect(testNumbers).toStrictEqual(result)
  }, { repeats: 0 })

  afterAll(() => {
    result.push(3)
    expect(testNumbers).toStrictEqual(result)
  })
})

const describeNumbers: number[] = []

describe('testing describe', () => {
  test('test 1', () => {
    describeNumbers.push(1)
  })
}, { repeats: 2 })

afterAll(() => {
  expect(describeNumbers).toStrictEqual([1, 1, 1])
})

const retryNumbers: number[] = []

describe('testing repeats with retry', () => {
  const result = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  test.fails('test 1', () => {
    retryNumbers.push(1)
    expect(1).toBe(2)
  }, { repeats: 4, retry: 1 })

  afterAll(() => {
    expect(retryNumbers).toStrictEqual(result)
  })
})

const nestedDescribeNumbers: number[] = []

describe('testing nested describe', () => {
  test ('test 1', () => {
    nestedDescribeNumbers.push(1)
  })

  describe('nested 1', () => {
    test('test 2', () => {
      nestedDescribeNumbers.push(2)
    })

    describe('nested 2', () => {
      test('test 3', () => {
        nestedDescribeNumbers.push(3)
      })

      describe('nested 3', () => {
        test('test 4', () => {
          nestedDescribeNumbers.push(4)
        })
      }, 100)
    }, { repeats: 2 })
  })

  afterAll(() => {
    expect(nestedDescribeNumbers).toStrictEqual([1, 1, 2, 2, 3, 3, 3, 4, 4, 4])
  })
}, { repeats: 1 })
