import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const dragAndDrop: UserEventCommand<UserEvent['dragAndDrop']> = async (
  context,
  source,
  target,
  options_,
) => {
  const $source = context.browser.$(source)
  const $target = context.browser.$(target)
  const options = (options_ || {}) as any
  const duration = options.duration ?? 10

  // https://github.com/webdriverio/webdriverio/issues/8022#issuecomment-1700919670
  await context.browser
    .action('pointer')
    .move({ duration: 0, origin: $source, x: options.sourceX ?? 0, y: options.sourceY ?? 0 })
    .down({ button: 0 })
    .move({ duration: 0, origin: 'pointer', x: 0, y: 0 })
    .pause(duration)
    .move({ duration: 0, origin: $target, x: options.targetX ?? 0, y: options.targetY ?? 0 })
    .move({ duration: 0, origin: 'pointer', x: 1, y: 0 })
    .move({ duration: 0, origin: 'pointer', x: -1, y: 0 })
    .up({ button: 0 })
    .perform()
}
