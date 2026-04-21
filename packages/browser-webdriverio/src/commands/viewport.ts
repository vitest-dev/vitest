import type { WebdriverBrowserProvider } from '../webdriverio'
import type { UserEventCommand } from './utils'

export const viewport: UserEventCommand<(options: {
  width: number
  height: number
}) => void> = async (context, options) => {
  await (context.provider as WebdriverBrowserProvider).setViewport(options)
}
