import { PlaywrightBrowserProvider } from './playwright'
import { WebdriverBrowserProvider } from './webdriver'
import { NoneBrowserProvider } from './none'
import { HappyDomBrowserProvider } from './happy-dom'

export const webdriverio = WebdriverBrowserProvider
export const playwright = PlaywrightBrowserProvider
export const none = NoneBrowserProvider
export const happyDom = HappyDomBrowserProvider
