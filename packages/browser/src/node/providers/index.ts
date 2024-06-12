import { PlaywrightBrowserProvider } from './playwright'
import { WebdriverIOBrowserProvider } from './webdriver'
import { PreviewBrowserProvider } from './preview'

export const webdriverio = WebdriverIOBrowserProvider
export const playwright = PlaywrightBrowserProvider
export const preview = PreviewBrowserProvider
