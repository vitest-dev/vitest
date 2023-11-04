import type { BrowserProvider } from 'vitest/nide'

declare var webdriverio: BrowserProvider
declare var playwright: BrowserProvider
declare var none: BrowserProvider

export { webdriverio, playwright, none }
