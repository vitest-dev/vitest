import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { getDescribedLocator, resolvePageCoordinates } from './utils'

export const hover: UserEventCommand<UserEvent['hover']> = async (
  context,
  selector,
  options = {},
) => {
  await getDescribedLocator(context, selector).hover({
    ...options,
    position: options.position
      && await resolvePageCoordinates(context, options.position, true),
  })
}
