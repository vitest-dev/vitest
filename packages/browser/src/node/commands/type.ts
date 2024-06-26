import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'
import { keyboardImplementation } from './keyboard'

export const type: UserEventCommand<UserEvent['type']> = async (
  context,
  xpath,
  text,
  options = {},
) => {
  const { skipClick = false, skipAutoClose = false } = options

  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { iframe } = context
    const element = iframe.locator(`xpath=${xpath}`)

    if (!skipClick) {
      await element.focus()
    }

    await keyboardImplementation(
      context.provider,
      context.contextId,
      text,
      () => element.selectText(),
      skipAutoClose,
    )
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    const element = browser.$(markedXpath)

    if (!skipClick && !await element.isFocused()) {
      await element.click()
    }

    await keyboardImplementation(
      context.provider,
      context.contextId,
      text,
      () => browser.execute(() => {
        const element = document.activeElement as HTMLInputElement
        if (element) {
          element.select()
        }
      }),
      skipAutoClose,
    )
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support typing`)
  }
}
