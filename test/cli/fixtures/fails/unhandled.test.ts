// @vitest-environment jsdom

import { expect, test } from 'vitest'

test('unhandled exception', () => {
  expect(1).toBe(1)
  addEventListener('custom', () => {
    throw new Error('some error')
  })
  dispatchEvent(new Event('custom'))
})
