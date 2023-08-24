import { describe, expect, test } from 'vitest'

describe.runIf(false)('should skip', () => {
  test('multiline', () => {
    expect(`
    Hello
      World
  `).toMatchSnapshot()
  })
})
