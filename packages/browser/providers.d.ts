import type { BrowserProvider } from 'vitest/nide'

declare const webdriverio: BrowserProvider
declare const playwright: BrowserProvider
declare const none: BrowserProvider

export { webdriverio, playwright, none }
