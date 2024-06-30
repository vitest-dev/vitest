import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const click: UserEventCommand<UserEvent['click']> = async (
  context,
  xpath,
  options = {},
) => {
  const provider = context.provider
  if (provider instanceof PlaywrightBrowserProvider) {
    const tester = context.iframe
    await tester.locator(`xpath=${xpath}`).click({
      timeout: 1000,
      ...options,
    })
  }
  else if (provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    await browser.$(markedXpath).click(options as any)
  }
  else {
    throw new TypeError(`Provider "${provider.name}" doesn't support click command`)
  }
}

export const dblClick: UserEventCommand<UserEvent['dblClick']> = async (
  context,
  xpath,
  options = {},
) => {
  const provider = context.provider
  if (provider instanceof PlaywrightBrowserProvider) {
    const tester = context.iframe
    await tester.locator(`xpath=${xpath}`).dblclick(options)
  }
  else if (provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    await browser.$(markedXpath).doubleClick()
  }
  else {
    throw new TypeError(`Provider "${provider.name}" doesn't support dblClick command`)
  }
}

export const tripleClick: UserEventCommand<UserEvent['tripleClick']> = async (
  context,
  xpath,
  options = {},
) => {
  const provider = context.provider
  if (provider instanceof PlaywrightBrowserProvider) {
    const tester = context.iframe
    await tester.locator(`xpath=${xpath}`).click({
      timeout: 1000,
      ...options,
      clickCount: 3,
    })
  }
  else if (provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    await browser
      .action('pointer', { parameters: { pointerType: 'mouse' } })
      // move the pointer over the button
      .move({ origin: await browser.$(markedXpath) })
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
    throw new TypeError(`Provider "${provider.name}" doesn't support tripleClick command`)
  }
}
