import type {
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
  }
}
