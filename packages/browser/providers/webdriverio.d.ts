import type { RemoteOptions } from 'webdriverio'

declare module 'vitest/node' {
  interface BrowserProviderOptions extends RemoteOptions {}

  export interface BrowserCommandContext {
    browser: WebdriverIO.Browser
  }
}
