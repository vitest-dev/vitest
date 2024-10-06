import type { RemoteOptions, ClickOptions, DragAndDropOptions } from 'webdriverio'
import '../matchers.js'

declare module 'vitest/node' {
  interface BrowserProviderOptions extends RemoteOptions {}

  export interface UserEventClickOptions extends ClickOptions {}

  export interface UserEventDragOptions extends DragAndDropOptions {
    sourceX?: number
    sourceY?: number
    targetX?: number
    targetY?: number
  }

  export interface BrowserCommandContext {
    browser: WebdriverIO.Browser
  }
}
