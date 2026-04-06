import type { UserEventCommand } from './utils'

export const viewport: UserEventCommand<(options: {
  width: number
  height: number
}) => void> = async (context, options) => {
  const { page } = context

  await page.setViewportSize(options)
}
