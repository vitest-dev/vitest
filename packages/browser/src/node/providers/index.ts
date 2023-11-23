import { PlaywrightBrowserProvider } from './playwright'
import { PuppeteerBrowserProvider } from './puppeteer'
import { WebdriverBrowserProvider } from './webdriver'
import { NoneBrowserProvider } from './none'

export const webdriverio = WebdriverBrowserProvider
export const playwright = PlaywrightBrowserProvider
export const puppeteer = PuppeteerBrowserProvider
export const none = NoneBrowserProvider
