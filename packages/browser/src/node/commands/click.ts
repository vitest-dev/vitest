import type { Page } from 'playwright'
import type { UserEvent } from '../../../context'
import type { UserEventCommand } from './utils'

// TODO: options
export const click: UserEventCommand<UserEvent['click']> = async (
  { provider },
  element,
  options,
) => {
  if (provider.name === 'playwright') {
    const page = (provider as any).page as Page
    await page.frameLocator('iframe[data-vitest]').locator(`xpath=${element}`).click(options)
    return
  }
  if (provider.name === 'webdriverio') {
    const page = (provider as any).browser as WebdriverIO.Browser
    const frame = await page.findElement('css selector', 'iframe[data-vitest]')
    await page.switchToFrame(frame)
    await (await page.$(`//${element}`)).click(options)
    return
  }
  throw new Error(`Provider "${provider.name}" doesn't support click command`)
}
