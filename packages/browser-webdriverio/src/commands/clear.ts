import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const clear: UserEventCommand<UserEvent['clear']> = async (
  context,
  selector,
) => {
  const browser = context.browser
  await browser.$(selector).clearValue()
}
