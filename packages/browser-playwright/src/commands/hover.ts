import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { getDescribedLocator } from './utils'

export const hover: UserEventCommand<UserEvent['hover']> = async (
  context,
  selector,
  options = {},
) => {
  await getDescribedLocator(context, selector).hover(options)
}
