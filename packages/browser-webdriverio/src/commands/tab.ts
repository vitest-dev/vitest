import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { Key } from 'webdriverio'

export const tab: UserEventCommand<UserEvent['tab']> = async (
  context,
  options = {},
) => {
  const browser = context.browser
  await browser.keys(options.shift === true ? [Key.Shift, Key.Tab] : [Key.Tab])
}
