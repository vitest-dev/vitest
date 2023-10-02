// @vitest-environment happy-dom

import { afterEach, test, vi } from 'vitest'

afterEach(() => {
  vi.useRealTimers()
})

test('fake timers don\'t fail when using empty config', () => {
  vi.useFakeTimers({})
})
