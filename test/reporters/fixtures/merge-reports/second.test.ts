import { describe, test, expect } from 'vitest'

test('test 2-1', () => {
  console.log('test 2-1')
  expect(1).toBe(2)
})

describe('group', () => {
  test('test 2-2', () => {
    expect(1).toBe(1)
  })

  test('test 2-3', () => {
    expect(1).toBe(1)
  })
})
