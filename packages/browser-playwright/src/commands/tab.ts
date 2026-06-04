import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const tab: UserEventCommand<UserEvent['tab']> = async (
  context,
  options = {},
) => {
  const page = context.page
  await page.keyboard.press(options.shift === true ? 'Shift+Tab' : 'Tab')
}
