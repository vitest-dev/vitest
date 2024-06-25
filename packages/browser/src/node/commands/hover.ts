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
    await context.iframe.locator(`xpath=${xpath}`).hover({
      timeout: 1000,
      ...options,
    })
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    await browser.$(markedXpath).moveTo(options)
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support hover`)
  }
}
