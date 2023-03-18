import type { Awaitable } from '@vitest/utils'
import type { Vitest } from 'vitest/node'

export interface BrowserProvider {
  initialize?(ctx: Vitest): Awaitable<void>
  start(url: string): Awaitable<void>
  canStart(): boolean
}

export interface BrowserProviderModule {
  new (): BrowserProvider
}

export interface BrowserConfigOptions {
  /**
   * browser provider
   * @experimental
   *
   * @default 'webdriver'
   */
  provider?: string

  /**
   * headless mode for the browser mode
   * @experimental
   *
   * @default process.env.CI
   */
  headless?: boolean
}
