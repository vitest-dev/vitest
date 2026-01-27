import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const fill: UserEventCommand<UserEvent['fill']> = async (
  context,
  selector,
  text,
  _options = {},
) => {
  const browser = context.browser
  await browser.$(selector).setValue(text)
}
