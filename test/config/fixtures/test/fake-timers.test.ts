import { test, vi } from 'vitest'

test('uses fake timers', () => {
  vi.useFakeTimers()

  vi.useRealTimers()
})
