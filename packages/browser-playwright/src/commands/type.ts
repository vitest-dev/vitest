import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { keyboardImplementation } from './keyboard'

export const type: UserEventCommand<UserEvent['type']> = async (
  context,
  selector,
  text,
  options = {},
) => {
  const { skipClick = false, skipAutoClose = false } = options
  const unreleased = new Set(Reflect.get(options, 'unreleased') as string[] ?? [])

  const { iframe } = context
  const element = iframe.locator(selector)

  if (!skipClick) {
    await element.focus()
  }

  await keyboardImplementation(
    unreleased,
    context.provider,
    context.sessionId,
    text,
    () => element.selectText(),
    skipAutoClose,
  )

  return {
    unreleased: Array.from(unreleased),
  }
}
