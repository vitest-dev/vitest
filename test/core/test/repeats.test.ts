import { getCurrentTest } from '@vitest/runner'
import { afterAll, describe, expect, test } from 'vitest'

const testNumbers: number[] = []

describe('testing it/test', () => {
  const result = [1, 1, 1, 1, 1, 2, 2, 2]

  test('test 1', { repeats: 4 }, () => {
    testNumbers.push(1)
  })

  test('test 2', { repeats: 2 }, () => {
    testNumbers.push(2)
  })

  test.fails('test 3', { repeats: 0 }, () => {
    testNumbers.push(3)
    expect(testNumbers).toStrictEqual(result)
  })

  afterAll(() => {
    result.push(3)
    expect(testNumbers).toStrictEqual(result)
  })
})

const describeNumbers: number[] = []

describe('testing describe', { repeats: 2 }, () => {
  test('test 1', () => {
    describeNumbers.push(1)
  })
})

afterAll(() => {
  expect(describeNumbers).toStrictEqual([1, 1, 1])
})

const retryNumbers: number[] = []

describe('testing repeats with retry', () => {
  describe('normal test', () => {
    const result = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    test.fails('test 1', { repeats: 4, retry: 1 }, () => {
      retryNumbers.push(1)
      expect(1).toBe(2)
    })

    afterAll(() => {
      expect(retryNumbers).toStrictEqual(result)
    })
  })

  test('should not reset retry count', { repeats: 2, retry: 1 }, () => {
    expect(getCurrentTest()!.result?.retryCount).toBe(3)
  })
})

const nestedDescribeNumbers: number[] = []

describe('testing nested describe', { repeats: 1 }, () => {
  test ('test 1', () => {
    nestedDescribeNumbers.push(1)
  })

  describe('nested 1', () => {
    test('test 2', () => {
      nestedDescribeNumbers.push(2)
    })

    describe('nested 2', { repeats: 2 }, () => {
      test('test 3', () => {
        nestedDescribeNumbers.push(3)
      })

      describe('nested 3', () => {
        test('test 4', () => {
          nestedDescribeNumbers.push(4)
        })
      }, 100)
    })
  })

  afterAll(() => {
    expect(nestedDescribeNumbers).toStrictEqual([1, 1, 2, 2, 3, 3, 3, 4, 4, 4])
  })
})
