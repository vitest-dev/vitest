import type { UserEvent } from '../../../context'
import type { UserEventCommand } from './utils'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'

export const fill: UserEventCommand<UserEvent['fill']> = async (
  context,
  selector,
  text,
  options = {},
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { iframe } = context
    const element = iframe.locator(selector)
    await element.fill(text, options)
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    await browser.$(selector).setValue(text)
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support clearing elements`)
  }
}
