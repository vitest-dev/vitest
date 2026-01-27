import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const dragAndDrop: UserEventCommand<UserEvent['dragAndDrop']> = async (
  context,
  source,
  target,
  options_,
) => {
  const frame = await context.frame()
  await frame.dragAndDrop(
    source,
    target,
    options_,
  )
}
