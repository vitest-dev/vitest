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

  const browser = context.browser
  const element = browser.$(selector)

  if (!skipClick && !await element.isFocused()) {
    await element.click()
  }

  await keyboardImplementation(
    unreleased,
    context.provider,
    context.sessionId,
    text,
    () => browser.execute(() => {
      const element = document.activeElement as HTMLInputElement
      if (element && typeof element.select === 'function') {
        element.select()
      }
    }),
    skipAutoClose,
  )

  return {
    unreleased: Array.from(unreleased),
  }
}
