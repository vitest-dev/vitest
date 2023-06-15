import { describe, expect, test } from 'vitest'

describe('suite timeout', () => {
  test('true is true after 100ms', async () => {
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(true).toBe(true)
  })
}, {
  timeout: 100,
})

describe('suite timeout simple input', () => {
  test('true is true after 100ms', async () => {
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(true).toBe(true)
  })
}, 100)
