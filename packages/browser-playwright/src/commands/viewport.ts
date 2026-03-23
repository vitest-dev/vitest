import type { PlaywrightBrowserProvider } from '../playwright'
import type { UserEventCommand } from './utils'

export const viewport: UserEventCommand<(options: {
  width: number
  height: number
}) => void> = async (context, options) => {
  const { provider, sessionId } = context

  await (provider as PlaywrightBrowserProvider).getPage(sessionId).setViewportSize(options)
}
