// @vitest-environment node

import { expect, onTestFinished, test, vi } from 'vitest'
import './fixtures/timers.suite'

test('refreshing a pending timeout preserves timer order', () => {
  vi.useFakeTimers({ now: 0 })
  onTestFinished(() => {
    vi.useRealTimers()
  })

  const fired: string[] = []
  const schedule = (name: string, delay: number) =>
    setTimeout(() => fired.push(`${name}@${Date.now()}`), delay)

  const timeout = schedule('a', 100)
  schedule('b', 110)
  schedule('c', 120)
  schedule('d', 130)

  vi.advanceTimersByTime(50)
  timeout.refresh()
  vi.runAllTimers()

  expect(fired).toEqual(['b@110', 'c@120', 'd@130', 'a@150'])
})
