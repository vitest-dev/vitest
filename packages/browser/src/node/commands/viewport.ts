import type { UserEventCommand } from './utils'
import { WebdriverBrowserProvider } from '../providers/webdriver'

export const viewport: UserEventCommand<(options: {
  width: number
  height: number
}) => void> = async (context, options) => {
  if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    // this takes a really long time to switch between iframes
    // but we can't pass down the context manually to wdio because
    // they don't provide the API for this
    const isSwitched = context.provider.isIframeSwitched()
    if (isSwitched) {
      await context.provider.switchToMainFrame()
    }
    await browser.setViewport(options)
    if (isSwitched) {
      await context.provider.switchToTestFrame()
    }
  }
  else {
    throw new TypeError(`Provider ${context.provider.name} doesn't support "viewport" command`)
  }
}
