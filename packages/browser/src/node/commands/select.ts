import type { ElementHandle } from 'playwright'
import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const selectOptions: UserEventCommand<UserEvent['selectOptions']> = async (
  context,
  xpath,
  values,
) => {
  const value = values as any as (string | { element: string })[]

  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { frame } = context
    const selectElement = frame.locator(`xpath=${xpath}`)

    const values = await Promise.all(value.map(async (v) => {
      if (typeof v === 'string')
        return v
      const elementHandler = await frame.locator(`xpath=${v.element}`).elementHandle()
      if (!elementHandler) {
        throw new Error(`Element not found: ${v.element}`)
      }
      return elementHandler
    })) as (readonly string[]) | (readonly ElementHandle[])

    await selectElement.selectOption(values)
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    // TODO
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" doesn't support selectOptions command`)
  }
}
