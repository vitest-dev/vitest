import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const click: UserEventCommand<UserEvent['click']> = async (
  context,
  selector,
  options = {},
) => {
  const tester = context.iframe
  await tester.locator(selector).click(options)
}

export const dblClick: UserEventCommand<UserEvent['dblClick']> = async (
  context,
  selector,
  options = {},
) => {
  const tester = context.iframe
  await tester.locator(selector).dblclick(options)
}

export const tripleClick: UserEventCommand<UserEvent['tripleClick']> = async (
  context,
  selector,
  options = {},
) => {
  const tester = context.iframe
  await tester.locator(selector).click({
    ...options,
    clickCount: 3,
  })
}
