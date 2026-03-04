import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { getDescribedLocator } from './utils'

export const fill: UserEventCommand<UserEvent['fill']> = async (
  context,
  selector,
  text,
  options = {},
) => {
  const element = getDescribedLocator(context, selector)
  await element.fill(text, options)
}
