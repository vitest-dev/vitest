import type {
  BrowserContext,
  BrowserContextOptions,
  Frame,
  LaunchOptions,
  Page,
} from 'playwright'

declare module 'vitest/node' {
  interface BrowserProviderOptions {
    launch?: LaunchOptions
    context?: Omit<
      BrowserContextOptions,
      'ignoreHTTPSErrors' | 'serviceWorkers'
    >
  }

  export interface BrowserCommandContext {
    page: Page
    frame: Frame
    context: BrowserContext
  }
}

type PWHoverOptions = Parameters<Page['hover']>[1]
type PWClickOptions = Parameters<Page['click']>[1]
type PWFillOptions = Parameters<Page['fill']>[2]
type PWScreenshotOptions = Parameters<Page['screenshot']>[0]

declare module '@vitest/browser/context' {
  export interface UserEventHoverOptions extends PWHoverOptions {}
  export interface UserEventClickOptions extends PWClickOptions {}
  export interface UserEventFillOptions extends PWFillOptions {}
  export interface ScreenshotOptions extends PWScreenshotOptions {}
}
