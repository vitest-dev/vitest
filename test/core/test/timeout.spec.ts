import { describe, expect, test } from 'vitest'

describe('suite timeout', () => {
  test('true is true after 5100ms', async () => {
    await new Promise(resolve => setTimeout(resolve, 5100))
    expect(true).toBe(true)
  })
}, {
  timeout: 6000,
})

describe('suite timeout simple input', () => {
  test('true is true after 5100ms', async () => {
    await new Promise(resolve => setTimeout(resolve, 5100))
    expect(true).toBe(true)
  })
}, 6000)
