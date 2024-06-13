import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const fill: UserEventCommand<UserEvent['fill']> = async (
  context,
  xpath,
  text,
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { tester } = context
    const element = tester.locator(`xpath=${xpath}`)
    await element.fill(text)
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    const element = await browser.$(markedXpath)
    await element.setValue(text)
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support clearing elements`)
  }
}
