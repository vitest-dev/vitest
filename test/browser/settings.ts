import type { BrowserInstanceOption } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import { webdriverio } from '@vitest/browser-webdriverio'

const providerName = (process.env.PROVIDER || 'playwright') as 'playwright' | 'webdriverio' | 'preview'

export const providers = {
  playwright: (options?: Parameters<typeof playwright>[0]) => playwright(process.env.BROWSER_WS_ENDPOINT
    ? {
        ...options,
        connectOptions: {
          wsEndpoint: process.env.BROWSER_WS_ENDPOINT,
          exposeNetwork: '<loopback>',
        },
      }
    : options),
  preview,
  webdriverio,
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

export const instances: BrowserInstanceOption[] = process.env.BROWSER
  ? [
      {
        browser: process.env.BROWSER as any,
        headless: process.env.BROWSER === 'safari' ? false : undefined,
      },
    ]
  : provider.name === 'playwright'
    ? playwrightInstances
    : webdriverioInstances
