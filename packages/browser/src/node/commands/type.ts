import type { UserEvent } from '../../../context'
import type { UserEventCommand } from './utils'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import { keyboardImplementation } from './keyboard'

export const type: UserEventCommand<UserEvent['type']> = async (
  context,
  selector,
  text,
  options = {},
) => {
  const { skipClick = false, skipAutoClose = false } = options
  const unreleased = new Set(Reflect.get(options, 'unreleased') as string[] ?? [])

  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { iframe } = context
    const element = iframe.locator(selector)

    if (!skipClick) {
      await element.focus()
    }

    await keyboardImplementation(
      unreleased,
      context.provider,
      context.sessionId,
      text,
      () => element.selectText(),
      skipAutoClose,
    )
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    const element = browser.$(selector)

    if (!skipClick && !await element.isFocused()) {
      await element.click()
    }

    await keyboardImplementation(
      unreleased,
      context.provider,
      context.sessionId,
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

  return {
    unreleased: Array.from(unreleased),
  }
}
