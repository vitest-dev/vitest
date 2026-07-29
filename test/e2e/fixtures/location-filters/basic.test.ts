import { describe, expect, it } from 'vitest'

describe('basic suite', () => {
  describe('inner suite', () => {
    it('some test', () => {
      expect(1).toBe(1)
    })

    it('another test', () => {
      expect(1).toBe(1)
    })
  })

  it('basic test', () => {
    expect(1).toBe(1)
  })
})

it('outside test', () => {
  expect(1).toBe(1)
})
