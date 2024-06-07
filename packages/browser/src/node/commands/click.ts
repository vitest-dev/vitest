import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import type { UserEventCommand } from './utils'

export const click: UserEventCommand<UserEvent['click']> = async (
  { provider, contextId },
  element,
  options = {},
) => {
  if (provider instanceof PlaywrightBrowserProvider) {
    const page = provider.getPage(contextId)
    await page.frameLocator('iframe[data-vitest]').locator(`xpath=${element}`).click(options)
    return
  }
  if (provider.name === 'webdriverio') {
    const page = (provider as any).browser as WebdriverIO.Browser
    const frame = await page.findElement('css selector', 'iframe[data-vitest]')
    await page.switchToFrame(frame)
    const xpath = `//${element}`
    await (await page.$(xpath)).click(options)
    return
  }
  throw new Error(`Provider "${provider.name}" doesn't support click command`)
}
