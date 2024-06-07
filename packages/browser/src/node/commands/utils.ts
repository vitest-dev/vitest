import type { BrowserCommand, BrowserProvider } from 'vitest/node'
import type { PlaywrightBrowserProvider } from '../providers/playwright'
import type { WebdriverBrowserProvider } from '../providers/webdriver'

declare module 'vitest/node' {
  export interface BrowserCommandContext {
    provider: PlaywrightBrowserProvider | WebdriverBrowserProvider | BrowserProvider
  }
}

export type UserEventCommand<T extends (...args: any) => any> = BrowserCommand<
  ConvertUserEventParameters<Parameters<T>>
>

type ConvertElementToLocator<T> = T extends Element ? string : T
type ConvertUserEventParameters<T extends unknown[]> = {
  [K in keyof T]: ConvertElementToLocator<T[K]>
}

export function defineBrowserCommand<T extends unknown[]>(
  fn: BrowserCommand<T>,
): BrowserCommand<T> {
  return fn
}
