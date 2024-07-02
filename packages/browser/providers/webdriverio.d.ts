import type { RemoteOptions } from 'webdriverio'
import '../matchers.js'

declare module 'vitest/node' {
  interface BrowserProviderOptions extends RemoteOptions {}

  export interface BrowserCommandContext {
    browser: WebdriverIO.Browser
  }
}
