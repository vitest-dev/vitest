import type { Page, LaunchOptions } from 'playwright'

declare module 'vitest/node' {
  interface BrowserProviderOptions {
    launch?: LaunchOptions
    page: Page | null
  }
}
