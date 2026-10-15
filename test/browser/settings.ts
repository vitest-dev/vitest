import type { BrowserInstanceOption } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'

const providerName = (process.env.PROVIDER || 'playwright') as 'playwright' | 'preview'

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
}

export const provider = providers[providerName]()

const playwrightInstances: BrowserInstanceOption[] = [
  { browser: 'chromium' },
  { browser: 'firefox' },
  // hard to setup playwright webkit on some machines (e.g. ArchLinux)
  // this allows skipping it locally by BROWSER_NO_WEBKIT=true
  ...(process.env.BROWSER_NO_WEBKIT ? [] : [{ browser: 'webkit' as const }]),
]

const previewInstances: BrowserInstanceOption[] = [
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
    : previewInstances
