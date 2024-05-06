// @vitest-environment jsdom

import { test } from 'vitest'

test('unhandled exception', () => {
  addEventListener('custom', () => {
    throw new Error('some error')
  })
  dispatchEvent(new Event('custom'))
})
