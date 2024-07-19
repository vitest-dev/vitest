import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const click: UserEventCommand<UserEvent['click']> = async (
  context,
  selector,
  options = {},
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const tester = context.iframe
    await tester.locator(`css=${selector}`).click({
      timeout: 1000,
      ...options,
    })
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    await browser.$(selector).click(options as any)
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" doesn't support click command`)
  }
}

export const dblClick: UserEventCommand<UserEvent['dblClick']> = async (
  context,
  selector,
  options = {},
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const tester = context.iframe
    await tester.locator(`css=${selector}`).dblclick(options)
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    await browser.$(selector).doubleClick()
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" doesn't support dblClick command`)
  }
}

export const tripleClick: UserEventCommand<UserEvent['tripleClick']> = async (
  context,
  selector,
  options = {},
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const tester = context.iframe
    await tester.locator(`css=${selector}`).click({
      timeout: 1000,
      ...options,
      clickCount: 3,
    })
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    await browser
      .action('pointer', { parameters: { pointerType: 'mouse' } })
      // move the pointer over the button
      .move({ origin: await browser.$(selector) })
      // simulate 3 clicks
      .down()
      .up()
      .pause(50)
      .down()
      .up()
      .pause(50)
      .down()
      .up()
      .pause(50)
      // run the sequence
      .perform()
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" doesn't support tripleClick command`)
  }
}
