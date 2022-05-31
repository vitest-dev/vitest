import { benchmark, describe, expect, test } from 'vitest'

describe('sort', () => {
  benchmark('normal', () => {
    const x = [1, 5, 4, 2, 3]
    x.sort((a, b) => {
      return a - b
    })
  })

  benchmark('reverse', () => {
    const x = [1, 5, 4, 2, 3]
    x.reverse().sort((a, b) => {
      return a - b
    })
  })

  test('add', () => {
    expect(1 + 1).toBe(2)
  })
})
