import { PlaywrightBrowserProvider } from './playwright'
import { PreviewBrowserProvider } from './preview'
import { WebdriverBrowserProvider } from './webdriver'

export const webdriverio = WebdriverBrowserProvider
export const playwright = PlaywrightBrowserProvider
export const preview = PreviewBrowserProvider
