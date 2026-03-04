import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const selectOptions: UserEventCommand<UserEvent['selectOptions']> = async (
  context,
  selector,
  userValues,
  _options = {},
) => {
  const values = userValues as any as [({ index: number })]

  if (!values.length) {
    return
  }

  const browser = context.browser

  if (values.length === 1 && 'index' in values[0]) {
    const selectElement = browser.$(selector)
    await selectElement.selectByIndex(values[0].index)
  }
  else {
    throw new Error('Provider "webdriverio" doesn\'t support selecting multiple values at once')
  }
}
