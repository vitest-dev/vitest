import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { focusIframe } from './utils'

export const tab: UserEventCommand<UserEvent['tab']> = async (context, options = {}) => {
  await focusIframe(context)
  const page = context.page
  await page.keyboard.press(options.shift === true ? 'Shift+Tab' : 'Tab')
}
