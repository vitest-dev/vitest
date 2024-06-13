import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const hover: UserEventCommand<UserEvent['hover']> = async (
  context,
  xpath,
  options = {},
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    await context.frame.locator(`xpath=${xpath}`).hover(options)
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    const element = await browser.$(markedXpath)
    await element.moveTo(options)
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support hover`)
  }
}
