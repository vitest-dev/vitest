import type { IOptionalBrowserSettings } from 'happy-dom'

declare module 'vitest/node' {
  interface BrowserProviderOptions extends IOptionalBrowserSettings {}
}
