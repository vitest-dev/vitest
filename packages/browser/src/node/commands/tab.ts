import type { UserEvent } from '../../../context'
import type { UserEventCommand } from './utils'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'

export const tab: UserEventCommand<UserEvent['tab']> = async (
  context,
  options = {},
) => {
  const provider = context.provider
  if (provider instanceof PlaywrightBrowserProvider) {
    const page = context.page
    await page.keyboard.press(options.shift === true ? 'Shift+Tab' : 'Tab')
    return
  }
  if (provider instanceof WebdriverBrowserProvider) {
    const { Key } = await import('webdriverio')
    const browser = context.browser
    await browser.keys(options.shift === true ? [Key.Shift, Key.Tab] : [Key.Tab])
    return
  }
  throw new Error(`Provider "${provider.name}" doesn't support tab command`)
}
