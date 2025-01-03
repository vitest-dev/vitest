import type { RemoteOptions, ClickOptions, DragAndDropOptions } from 'webdriverio'
import '../matchers.js'
import type {} from "vitest/node"

declare module 'vitest/node' {
  export interface BrowserProviderOptions extends Partial<RemoteOptions> {}

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
