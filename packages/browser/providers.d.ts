import type { BrowserProviderModule } from 'vitest/node'

declare const webdriverio: BrowserProviderModule
declare const playwright: BrowserProviderModule
declare const preview: BrowserProviderModule

export { webdriverio, playwright, preview }
