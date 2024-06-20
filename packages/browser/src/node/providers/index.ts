import { PlaywrightBrowserProvider } from './playwright'
import { WebdriverBrowserProvider } from './webdriver'
import { PreviewBrowserProvider } from './preview'

export const webdriverio = WebdriverBrowserProvider
export const playwright = PlaywrightBrowserProvider
export const preview = PreviewBrowserProvider
