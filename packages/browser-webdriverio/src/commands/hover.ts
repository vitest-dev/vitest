import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const hover: UserEventCommand<UserEvent['hover']> = async (
  context,
  selector,
  options = {},
) => {
  const browser = context.browser
  await browser.$(selector).moveTo(options as any)
}
