import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const hover: UserEventCommand<UserEvent['hover']> = async (
  context,
  selector,
  options = {},
) => {
  await context.iframe.locator(selector).hover(options)
}
