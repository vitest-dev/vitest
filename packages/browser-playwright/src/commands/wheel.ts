import type { Locator, UserEventWheelDeltaOptions } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { hover } from './hover'

type WheelCommand = (element: Locator | Element, options: UserEventWheelDeltaOptions) => Promise<void>

export const wheel: UserEventCommand<WheelCommand> = async (
  context,
  selector,
  options,
) => {
  await hover(context, selector)

  const times = options.times ?? 1
  const deltaX = options.delta.x ?? 0
  const deltaY = options.delta.y ?? 0

  for (let count = 0; count < times; count += 1) {
    await context.page.mouse.wheel(deltaX, deltaY)
  }
}
