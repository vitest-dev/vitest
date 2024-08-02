import type { RemoteOptions } from 'webdriverio'
import '../matchers.js'

declare module 'vitest/node' {
  interface BrowserProviderOptions extends RemoteOptions {}
  export interface UserEventDragOptions {
    duration?: number
    sourceX?: number
    sourceY?: number
    targetX?: number
    targetY?: number
  }

  export interface BrowserCommandContext {
    browser: WebdriverIO.Browser
  }
}
