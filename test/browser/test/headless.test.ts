import { expect, it } from 'vitest'

it('is running in headless mode', () => {
  expect(navigator.userAgent.search(/headless/i)).not.toBe(-1)
})
