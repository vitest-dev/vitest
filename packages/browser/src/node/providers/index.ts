import { PlaywrightBrowserProvider } from './playwright'
import { PreviewBrowserProvider } from './preview'
import { WebdriverBrowserProvider } from './webdriver'

export const webdriverio: typeof WebdriverBrowserProvider = WebdriverBrowserProvider
export const playwright: typeof PlaywrightBrowserProvider = PlaywrightBrowserProvider
export const preview: typeof PreviewBrowserProvider = PreviewBrowserProvider
