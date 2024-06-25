import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const fill: UserEventCommand<UserEvent['fill']> = async (
  context,
  xpath,
  text,
  options = {},
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { iframe } = context
    const element = iframe.locator(`xpath=${xpath}`)
    await element.fill(text, { timeout: 1000, ...options })
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    await browser.$(markedXpath).setValue(text)
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support clearing elements`)
  }
}
