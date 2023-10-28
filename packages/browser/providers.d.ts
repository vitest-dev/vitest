import type { BrowserProvider } from 'vitest/nide'

declare var webdriverio: BrowserProvider
declare var playwright: BrowserProvider

export { webdriverio, playwright }
