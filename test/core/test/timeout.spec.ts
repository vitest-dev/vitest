import { describe, expect, test } from 'vitest'

describe('suite timeout', () => {
  test('timeout is inherited', async ({ task }) => {
    expect(task.timeout).toBe(100)
  })
}, {
  timeout: 100,
})

describe('suite timeout simple input', () => {
  test('timeout is inherited', async ({ task }) => {
    expect(task.timeout).toBe(100)
  })
}, 100)
