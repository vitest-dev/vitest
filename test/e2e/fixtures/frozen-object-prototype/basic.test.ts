import { describe, expect, test } from 'vitest'

Object.freeze(Object.prototype)

describe('with frozen Object.prototype', () => {
  test('collects and runs', () => {
    expect(1 + 1).toBe(2)
  })
})
