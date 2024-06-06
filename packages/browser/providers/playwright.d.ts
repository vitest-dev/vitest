import type { BrowserContextOptions, LaunchOptions } from 'playwright'

declare module 'vitest/node' {
  interface BrowserProviderOptions {
    launch?: LaunchOptions
    context?: BrowserContextOptions
  }
}
