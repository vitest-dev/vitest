import type { Locator } from '@vitest/browser/context'
import type { BrowserCommand } from 'vitest/node'

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
