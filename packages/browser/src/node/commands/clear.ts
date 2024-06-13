import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const clear: UserEventCommand<UserEvent['clear']> = async (
  context,
  xpath,
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { frame } = context
    const element = frame.locator(`xpath=${xpath}`)
    await element.clear()
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    const element = await browser.$(markedXpath)
    await element.clearValue()
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support clearing elements`)
  }
}
