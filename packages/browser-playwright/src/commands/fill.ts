import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const fill: UserEventCommand<UserEvent['fill']> = async (
  context,
  selector,
  text,
  options = {},
) => {
  const { iframe } = context
  const element = iframe.locator(selector)
  await element.fill(text, options)
}
