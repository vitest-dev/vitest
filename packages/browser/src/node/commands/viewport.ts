import type { UserEventCommand } from './utils'
import { WebdriverBrowserProvider } from '../providers/webdriver'

export const viewport: UserEventCommand<(options: {
  width: number
  height: number
}) => void> = async (context, options) => {
  if (context.provider instanceof WebdriverBrowserProvider) {
    await context.provider.setViewport(options)
  }
  else {
    throw new TypeError(`Provider ${context.provider.name} doesn't support "viewport" command`)
  }
}
