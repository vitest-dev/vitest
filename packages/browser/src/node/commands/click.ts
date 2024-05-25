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
    await page.frameLocator('#vitest-tester-frame').locator(element).click(options)
  }
  if (provider.name === 'webdriverio') {
    // TODO: test
    const page = (provider as any).browser as WebdriverIO.Browser
    const frame = await page.findElement('css selector', '#vitest-tester-frame')
    await page.switchToFrame(frame)
    ;(await page.$(element)).click(options)
  }
}
