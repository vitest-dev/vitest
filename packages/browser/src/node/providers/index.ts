import { PlaywrightBrowserProvider } from './playwright'
import { WebdriverBrowserProvider } from './webdriver'
import { NoneBrowserProvider } from './none'

export const webdriverio = WebdriverBrowserProvider
export const playwright = PlaywrightBrowserProvider
export const none = NoneBrowserProvider
