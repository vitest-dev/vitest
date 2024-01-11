import type { Browser, LaunchOptions } from 'playwright'

declare module 'vitest/node' {
  interface BrowserProviderOptions {
    launch?: LaunchOptions
    page?: Parameters<Browser['newPage']>[0]
  }
}
