import { afterEach, describe, expect, test } from 'vitest'

describe('', () => {
  afterEach(() => {
    expect.soft(1 + 1, 'one plus one').toBe(3)
    expect.soft(2 + 2, 'two plus two').toBe(5)
    expect.soft(3 + 3, 'three plus three').toBe(10)
  })

  afterEach(() => {
    expect.soft(1 * 1, 'one times one').toBe(2)
    expect.soft(2 * 2, 'two times two').toBe(5)
    expect(3 * 3, 'three times three').toBe(10)
  })

  test('')
})
