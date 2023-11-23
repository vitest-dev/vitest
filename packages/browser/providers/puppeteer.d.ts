import type { LaunchOptions } from 'puppeteer'

declare module 'vitest/node' {
  interface BrowserProviderOptions {
    launch?: LaunchOptions
  }
}
