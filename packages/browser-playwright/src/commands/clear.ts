import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const clear: UserEventCommand<UserEvent['clear']> = async (
  context,
  selector,
) => {
  const { iframe } = context
  const element = iframe.locator(selector)
  await element.clear()
}
