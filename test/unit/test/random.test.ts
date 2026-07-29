import { describe, expect, test } from 'vitest'

// tests use seed of 101, so they have deterministic random order
const numbers: number[] = []

describe.shuffle('random tests', () => {
  describe('suite unshuffle', { shuffle: false }, () => {
    test('inside 1', () => {
      numbers.push(1)
    })
    test('inside 1.5', () => {
      numbers.push(1.5)
    })
    test('inside 2', () => {
      numbers.push(2)
    })

    describe('suite shuffle', { shuffle: true }, () => {
      test('inside 2.1', () => {
        numbers.push(2.1)
      })
      test('inside 2.2', () => {
        numbers.push(2.2)
      })
      test('inside 2.3', () => {
        numbers.push(2.3)
      })
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
})

test('assert', () => {
  expect(numbers).toMatchInlineSnapshot(`
      [
        4,
        5,
        3,
        1,
        1.5,
        2,
        2.2,
        2.3,
        2.1,
      ]
    `)
})
