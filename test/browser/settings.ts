import type { BrowserInstanceOption } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import { webdriverio } from '@vitest/browser-webdriverio'

const providerName = (process.env.PROVIDER || 'playwright') as 'playwright' | 'webdriverio' | 'preview'

const wsEndpoint = process.env.BROWSER_WS_ENDPOINT === 'true' ? 'ws://127.0.0.1:6677/' : process.env.BROWSER_WS_ENDPOINT

export const providers = {
  playwright: (options?: Parameters<typeof playwright>[0]) => playwright(wsEndpoint
    ? {
        ...options,
        connectOptions: {
          wsEndpoint,
          exposeNetwork: '<loopback>',
        },
      }
    : options),
  preview,
  webdriverio: (options?: Parameters<typeof webdriverio>[0]) => {
    const capabilities = options?.capabilities || {}

    return webdriverio({
      ...options,
      capabilities: {
        ...capabilities,
        // Explicit browser/driver binaries keep WebDriverIO from auto-downloading mismatched versions.
        // https://webdriver.io/docs/driverbinaries
        // https://webdriver.io/docs/capabilities#webdriverio-capabilities-to-manage-browser-driver-options
        ...(process.env.CHROMEDRIVER_PATH && process.env.CHROME_BIN
          ? {
              'wdio:chromedriverOptions': {
                ...(capabilities as any)['wdio:chromedriverOptions'],
                binary: process.env.CHROMEDRIVER_PATH,
              },
              // https://developer.chrome.com/docs/chromedriver/capabilities#chromeoptions-object
              'goog:chromeOptions': {
                ...(capabilities as any)['goog:chromeOptions'],
                binary: process.env.CHROME_BIN,
              },
            }
          : {}),
        ...(process.env.FIREFOX_BIN
          ? {
              // https://developer.mozilla.org/en-US/docs/Web/WebDriver/Reference/Capabilities/firefoxOptions
              'moz:firefoxOptions': {
                ...(capabilities as any)['moz:firefoxOptions'],
                binary: process.env.FIREFOX_BIN,
              },
            }
          : {}),
      },
    })
  },
}

export const provider = providers[providerName]()

const playwrightInstances: BrowserInstanceOption[] = [
  { browser: 'chromium' },
  { browser: 'firefox' },
  // hard to setup playwright webkit on some machines (e.g. ArchLinux)
  // this allows skipping it locally by BROWSER_NO_WEBKIT=true
  ...(process.env.BROWSER_NO_WEBKIT ? [] : [{ browser: 'webkit' as const }]),
]

const webdriverioInstances: BrowserInstanceOption[] = [
  { browser: 'chrome' },
  { browser: 'firefox' },
]

// use TEST_BROWSER to avoid BROWSER being selected for UI --open
const testBrowser = process.env.TEST_BROWSER ?? process.env.BROWSER

export const instances: BrowserInstanceOption[] = testBrowser
  ? [
      {
        browser: testBrowser as any,
        headless:
          wsEndpoint
            ? true
            : testBrowser === 'safari' ? false : undefined,
      },
    ]
  : provider.name === 'playwright'
    ? playwrightInstances
    : webdriverioInstances
