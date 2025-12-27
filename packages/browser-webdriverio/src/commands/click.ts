import type { UserEvent } from 'vitest/browser'
import type { UserEventCommand } from './utils'

export const click: UserEventCommand<UserEvent['click']> = async (
  context,
  selector,
  options,
) => {
  const browser = context.browser
  await browser.$(selector).click(options)
}

export const dblClick: UserEventCommand<UserEvent['dblClick']> = async (
  context,
  selector,
  _options,
) => {
  const browser = context.browser
  await browser.$(selector).doubleClick()
}

export const tripleClick: UserEventCommand<UserEvent['tripleClick']> = async (
  context,
  selector,
  _options,
) => {
  const browser = context.browser
  await browser
    .action('pointer', { parameters: { pointerType: 'mouse' } })
  // move the pointer over the button
    .move({ origin: browser.$(selector) })
  // simulate 3 clicks
    .down()
    .up()
    .pause(50)
    .down()
    .up()
    .pause(50)
    .down()
    .up()
    .pause(50)
  // run the sequence
    .perform()
}
