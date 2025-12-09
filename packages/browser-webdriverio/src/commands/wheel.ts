import type { Locator, UserEventWheelDeltaOptions } from 'vitest/browser'
import type { UserEventCommand } from './utils'

type WheelCommand = (element: Locator | Element, options: UserEventWheelDeltaOptions) => Promise<void>

export const wheel: UserEventCommand<WheelCommand> = async (
  context,
  selector,
  options,
) => {
  const browser = context.browser
  const times = options.times ?? 1
  const deltaX = options.delta.x ?? 0
  const deltaY = options.delta.y ?? 0

  let action = browser.action('wheel')
  const wheelOptions: Parameters<typeof action['scroll']>[0] = {
    deltaX,
    deltaY,
    origin: browser.$(selector),
  }

  for (let count = 0; count < times; count += 1) {
    action = action.scroll(wheelOptions)
  }

  await action.perform()
}
