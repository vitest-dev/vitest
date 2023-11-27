// @vitest-environment happy-dom

import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

test('fake timers don\'t fail when using empty config', () => {
  vi.useFakeTimers({})
})

test('global CSS is injected correctly', () => {
  expect(CSS).toBeDefined()
  expect(CSS.escape).toBeDefined()
  expect(CSS.supports).toBeDefined()
})
