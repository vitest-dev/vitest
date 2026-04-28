import type { SerializedLocator } from '@vitest/browser'
import type { Locator } from 'vitest/browser'
import type { BrowserCommand } from 'vitest/node'

export type UserEventCommand<T extends (...args: any) => any> = BrowserCommand<
  ConvertUserEventParameters<Parameters<T>>
>

type ConvertElementToLocator<T> = T extends Element | Locator ? SerializedLocator : T
type ConvertUserEventParameters<T extends unknown[]> = {
  [K in keyof T]: ConvertElementToLocator<T[K]>;
}
