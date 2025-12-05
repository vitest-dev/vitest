import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { hover } from './hover'

export const wheel: UserEventCommand<UserEvent['wheel']> = async (
  context,
  selector,
  deltaX,
  deltaY,
) => {
  const browser = context.browser
  await hover(context, selector)
  await browser.scroll(deltaX, deltaY)
}
