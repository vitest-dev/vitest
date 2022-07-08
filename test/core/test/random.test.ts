import { afterAll, describe, expect, test } from 'vitest'

// tests use seed of 101, so they have deterministic random order
const numbers: number[] = []

describe.shuffle('random tests', () => {
  describe('inside', () => {
    // shuffle is not inhereted from parent

    test('inside 1', () => {
      numbers.push(1)
    })
    test('inside 2', () => {
      numbers.push(2)
    })
  })

  test('test 1', () => {
    numbers.push(3)
  })
  test('test 2', () => {
    numbers.push(4)
  })
  test('test 3', () => {
    numbers.push(5)
  })

  afterAll(() => {
    expect(numbers).toStrictEqual([4, 5, 3, 1, 2])
  })
})
