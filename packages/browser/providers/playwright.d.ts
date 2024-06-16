import type {
  BrowserContextOptions,
  FrameLocator,
  LaunchOptions,
  Locator,
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
    tester: FrameLocator
    body: Locator
  }
}
