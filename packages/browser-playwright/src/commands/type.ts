import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { keyboardImplementation } from './keyboard'
import { getDescribedLocator } from './utils'

export const type: UserEventCommand<UserEvent['type']> = async (
  context,
  selector,
  text,
  options = {},
) => {
  const { skipClick = false, skipAutoClose = false } = options
  const unreleased = new Set(Reflect.get(options, 'unreleased') as string[] ?? [])

  const element = getDescribedLocator(context, selector)

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
