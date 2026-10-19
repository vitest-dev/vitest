# Timers

When we test code that involves timeouts or intervals, instead of having our tests wait it out or timeout, we can speed up our tests by using "fake" timers that mock calls to `setTimeout` and `setInterval`.

See the [`vi.useFakeTimers` API section](/api/vi#vi-usefaketimers) for a more in depth detailed API description.

## Example

```js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function executeAfterTwoHours(func) {
  setTimeout(func, 1000 * 60 * 60 * 2) // 2 hours
}

function executeEveryMinute(func) {
  setInterval(func, 1000 * 60) // 1 minute
}

const mock = vi.fn(() => console.log('executed'))

describe('delayed execution', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })
  it('should execute the function', () => {
    executeAfterTwoHours(mock)
    vi.runAllTimers()
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('should not execute the function', () => {
    executeAfterTwoHours(mock)
    // advancing by 2ms won't trigger the func
    vi.advanceTimersByTime(2)
    expect(mock).not.toHaveBeenCalled()
  })
  it('should execute every minute', () => {
    executeEveryMinute(mock)
    vi.advanceTimersToNextTimer()
    expect(mock).toHaveBeenCalledTimes(1)
    vi.advanceTimersToNextTimer()
    expect(mock).toHaveBeenCalledTimes(2)
  })
})
```

## Automatic Advancing {#automatic-advancing}

Some Vitest APIs wait for a condition to be met. When fake timers are enabled, these APIs advance them while waiting:

- [`vi.waitFor`](/api/vi#vi-waitfor) and [`vi.waitUntil`](/api/vi#vi-waituntil) advance timers by `interval` before every check.
- [`expect.poll`](/api/expect#poll) advances timers by `interval` after every failed attempt.
- In Browser Mode, [`expect.element`](/api/browser/assertions) advances timers while it retries, and [locator](/api/browser/locators#methods) and [`userEvent`](/api/browser/interactivity) methods advance them while waiting for an element. Methods that don't take an element, such as `userEvent.keyboard` and `userEvent.tab`, don't wait, so they don't advance timers.

Because fake time moves while these APIs wait, the timer state after awaiting one of them depends on how long the wait took.

## Tick Modes {#tick-modes}

By default, fake timers only move when you advance them or when one of the APIs above waits. [`vi.setTimerTickMode`](/api/vi#vi-settimertickmode) makes them advance on their own:

- `interval` advances fake time by a fixed step on a real-time interval, so it stays roughly in step with real time. It suits code where some state only lasts for a limited time.
- `nextTimerAsync` runs the next pending timer after each macrotask, so chained timers fire almost back to back. It suits code that eventually settles, but state that only lasts for a limited time can disappear before an assertion or action sees it.
