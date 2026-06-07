import type { UserEvent } from 'vitest/browser'
import type { BrowserCommandContext } from 'vitest/node'
import type { UserEventCommand } from './utils'
import { getDescribedLocator } from './utils'

const waitForIntervals = [0, 20, 50, 100, 100, 500]

async function advanceFakeTimers(context: BrowserCommandContext, interval: number) {
  const frame = await context.frame()
  await frame.evaluate(async (ms) => {
    const vi = (window as any).__vitest_index__?.vi
    if (vi?.isFakeTimers?.()) {
      await vi.advanceTimersByTimeAsync(ms)
    }
  }, interval)
}

async function waitForLocator(context: BrowserCommandContext, locator: ReturnType<typeof getDescribedLocator>, timeout?: number) {
  if (!timeout) {
    return
  }

  const startTime = Date.now()
  let intervalIndex = 0

  while (true) {
    const count = await locator.count()
    if (count > 0) {
      return
    }

    const elapsed = Date.now() - startTime
    if (elapsed >= timeout) {
      return
    }

    const interval = waitForIntervals[Math.min(intervalIndex++, waitForIntervals.length - 1)]
    const nextInterval = Math.min(interval, timeout - elapsed)
    await advanceFakeTimers(context, nextInterval)
  }
}

export const click: UserEventCommand<UserEvent['click']> = async (
  context,
  selector,
  options = {},
) => {
  const locator = getDescribedLocator(context, selector)
  await waitForLocator(context, locator, options.timeout)
  await locator.click(options)
}

export const dblClick: UserEventCommand<UserEvent['dblClick']> = async (
  context,
  selector,
  options = {},
) => {
  const locator = getDescribedLocator(context, selector)
  await waitForLocator(context, locator, options.timeout)
  await locator.dblclick(options)
}

export const tripleClick: UserEventCommand<UserEvent['tripleClick']> = async (
  context,
  selector,
  options = {},
) => {
  const locator = getDescribedLocator(context, selector)
  await waitForLocator(context, locator, options.timeout)
  await locator.click({
    ...options,
    clickCount: 3,
  })
}
