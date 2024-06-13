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
    const { frame, page } = context
    const element = frame.locator(`xpath=${xpath}`)

    if (!skipClick) {
      await element.focus()
    }

    const { pressed } = await keyboardImplementation(
      context.provider,
      context.contextId,
      text,
      () => element.selectText(),
    )

    if (!skipAutoClose) {
      for (const key of pressed) {
        await page.keyboard.up(key)
      }
    }
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const markedXpath = `//${xpath}`
    const element = await browser.$(markedXpath)

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
    )
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support typing`)
  }
}
