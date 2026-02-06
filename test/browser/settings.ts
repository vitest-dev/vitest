import type { BrowserInstanceOption } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { preview } from '@vitest/browser-preview'
import { webdriverio } from '@vitest/browser-webdriverio'

const providerName = (process.env.PROVIDER || 'playwright') as 'playwright' | 'webdriverio' | 'preview'
export const providers = {
  playwright,
  preview,
  webdriverio,
}

// Run browser test suites with playwright browsers in docker container
// $ docker compose up -d
// $ BROWSER_WS_ENDPOINT=ws://127.0.0.1:6677/ pnpm test:playwright
export const provider
  = providerName === 'playwright' && process.env.BROWSER_WS_ENDPOINT
    ? playwright({
        connectOptions: {
          wsEndpoint: process.env.BROWSER_WS_ENDPOINT,
          exposeNetwork: '<loopback>',
        },
      })
    : providers[providerName]()

export const browser = process.env.BROWSER || (provider.name !== 'playwright' ? 'chromium' : 'chrome')

const devInstances: BrowserInstanceOption[] = [
  { browser: browser as any },
]

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

export const instances = process.env.BROWSER
  ? devInstances
  : provider.name === 'playwright'
    ? playwrightInstances
    : webdriverioInstances
