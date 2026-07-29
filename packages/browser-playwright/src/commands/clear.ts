import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { getDescribedLocator } from './utils'

export const clear: UserEventCommand<UserEvent['clear']> = async (
  context,
  selector,
) => {
  const element = getDescribedLocator(context, selector)
  await element.clear()
}
