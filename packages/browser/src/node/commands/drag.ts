import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const dragAndDrop: UserEventCommand<UserEvent['dragAndDrop']> = async (
  context,
  source,
  target,
  options,
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    await context.frame.dragAndDrop(
      `xpath=${source}`,
      `xpath=${target}`,
      options,
    )
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const sourceXpath = `//${source}`
    const targetXpath = `//${target}`
    await context.browser.$(sourceXpath).dragAndDrop(
      await context.browser.$(targetXpath),
      options,
    )
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support dragging elements`)
  }
}
