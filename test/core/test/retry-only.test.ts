import { describe, expect, it } from 'vitest'

describe.only('description.only retry', () => {
  let count4 = 0
  let count5 = 0
  it('test should inherit options from the description block if missing', () => {
    count4 += 1
    expect(count4).toBe(2)
  })

  it('test should not inherit options from the description block if exists', () => {
    count5 += 1
    expect(count5).toBe(5)
  }, { retry: 4 })
}, { retry: 1 })
