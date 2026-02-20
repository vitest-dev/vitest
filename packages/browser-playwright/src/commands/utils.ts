import type { Locator } from 'vitest/browser'
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'
import { asLocator } from 'ivya'

export type UserEventCommand<T extends (...args: any) => any> = BrowserCommand<
  ConvertUserEventParameters<Parameters<T>>
>

type ConvertElementToLocator<T> = T extends Element | Locator ? string : T
type ConvertUserEventParameters<T extends unknown[]> = {
  [K in keyof T]: ConvertElementToLocator<T[K]>;
}

export function defineBrowserCommand<T extends unknown[]>(
  fn: BrowserCommand<T>,
): BrowserCommand<T> {
  return fn
}

// strip iframe locator part from the trace description e.g.
// - locator('[data-vitest="true"]').contentFrame().getByRole('button')
//     ⇓
// - getByRole('button')
export function getDescribedLocator(
  context: BrowserCommandContext,
  selector: string,
): ReturnType<BrowserCommandContext['iframe']['locator']> {
  const locator = context.iframe.locator(selector)
  return typeof locator.describe === 'function'
    ? locator.describe(asLocator('javascript', selector))
    : locator
}
