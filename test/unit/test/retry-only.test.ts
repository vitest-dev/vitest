import { describe, expect, it } from 'vitest'

describe.only('description.only retry', { retry: 1 }, () => {
  let count4 = 0
  let count5 = 0
  it('test should inherit options from the description block if missing', () => {
    count4 += 1
    expect(count4).toBe(2)
  })

  it('test should not inherit options from the description block if exists', { retry: 4 }, () => {
    count5 += 1
    expect(count5).toBe(5)
  })
})
