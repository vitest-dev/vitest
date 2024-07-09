import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'
import type { PointerInput } from './pointer-helper'

export const pointer: UserEventCommand<UserEvent['pointer']> = async (
  context,
  input: PointerInput,
) => {
  const provider = context.provider
  // todo: cleanup
  if (!input.length || provider instanceof PlaywrightBrowserProvider) {
    return
  }

  // const provider = context.provider
  if (provider instanceof PlaywrightBrowserProvider) {
    throw new TypeError(`Provider "${provider.name}" does not support pointer events`)
  }
  else if (provider instanceof WebdriverBrowserProvider) {
    const browser = context.browser
    await import('./webdriver-pointer').then(({ webdriverPointerImplementation }) => webdriverPointerImplementation(browser, input))
  }
  else {
    throw new TypeError(`Provider "${provider.name}" does not support pointer events`)
  }
}
/*
async function _playwrightPointerImplementation(
  provider: PlaywrightBrowserProvider,
  input: PointerInput,
) {
  const actions = provider.browser
} */
