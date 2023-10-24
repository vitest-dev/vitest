import type { Browser, LaunchOptions } from 'playwright'

declare module 'vitest/node' {
  interface BrowserProviderOptions {
    playwright?: {
      launch?: LaunchOptions
      page?: Parameters<Browser['newPage']>[0]
    }
  }
}
