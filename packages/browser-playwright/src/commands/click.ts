import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { getDescribedLocator, resolvePageCoordinates } from './utils'

export const click: UserEventCommand<UserEvent['click']> = async (
  context,
  selector,
  options = {},
) => {
  await getDescribedLocator(context, selector).click({
    ...options,
    position: options.position
      && await resolvePageCoordinates(context, options.position, true),
  })
}

export const dblClick: UserEventCommand<UserEvent['dblClick']> = async (
  context,
  selector,
  options = {},
) => {
  await getDescribedLocator(context, selector).dblclick({
    ...options,
    position: options.position
      && await resolvePageCoordinates(context, options.position, true),
  })
}

export const tripleClick: UserEventCommand<UserEvent['tripleClick']> = async (
  context,
  selector,
  options = {},
) => {
  await getDescribedLocator(context, selector).click({
    ...options,
    position: options.position
      && await resolvePageCoordinates(context, options.position, true),
    clickCount: 3,
  })
}
