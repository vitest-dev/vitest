import type { Page } from 'playwright'
import type { BrowserProvider } from 'vitest/node'
import type { UserEvent } from '../../../context'
import type { UserEventCommand } from './utils'

// TODO: options
export const click: UserEventCommand<UserEvent['click']> = async (
  { provider },
  element,
  options = {},
) => {
  if (provider.name === 'playwright') {
    const page = (provider as any).page as Page
    await page.frameLocator('iframe[data-vitest]').locator(`xpath=${element}`).click(options)
    return
  }
  if (provider.name === 'webdriverio') {
    return new Promise<void>((resolve, reject) => {
      let timeout: NodeJS.Timeout
      if (options.timeout) {
        timeout = setTimeout(() => {
          reject(new Error(`Element "${element}" not found in ${options.timeout}ms`))
        }, options.timeout)
      }

      webdriverioClick(provider, element, options).then(resolve, reject).finally(() => {
        if (timeout)
          clearTimeout(timeout)
      })
    })
  }
  throw new Error(`Provider "${provider.name}" doesn't support click command`)
}

async function webdriverioClick(provider: BrowserProvider, element: string, options: any) {
  const page = (provider as any).browser as WebdriverIO.Browser
  const frame = await page.findElement('css selector', 'iframe[data-vitest]')
  await page.switchToFrame(frame)
  await (await page.$(`//${element}`)).click(options)
}
