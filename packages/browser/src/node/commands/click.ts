import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverIOBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const click: UserEventCommand<UserEvent['click']> = async (
  context,
  xpath,
  options = {},
) => {
  const provider = context.provider
  if (provider instanceof PlaywrightBrowserProvider) {
    const tester = context.tester
    await tester.locator(`xpath=${xpath}`).click(options)
    return
  }
  if (provider instanceof WebdriverIOBrowserProvider) {
    const page = context.browser
    const markedXpath = `//${xpath}`
    const element = await page.$(markedXpath)
    await element.click(options)
    return
  }
  throw new Error(`Provider "${provider.name}" doesn't support click command`)
}
