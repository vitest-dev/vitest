import { beforeEach, describe, expect, it } from 'vitest'

describe('hooks should timeout', () => {
  beforeEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
  }, 10)
  it('hello', () => {
    expect(true).toBe(true)
  })
})
