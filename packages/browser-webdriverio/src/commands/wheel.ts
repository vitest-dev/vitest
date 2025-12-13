import type { Locator, WheelOptionsWithDelta } from 'vitest/browser'
import type { UserEventCommand } from './utils'

type WheelCommand = (element: Locator | Element | null, options: WheelOptionsWithDelta) => Promise<void>

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

  for (let count = 0; count < times; count += 1) {
    action = action.scroll({
      deltaX,
      deltaY,
      origin: selector === null ? undefined : browser.$(selector),
    })
  }

  await action.perform()
}
