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

export const provider = providers[providerName]()
export const browser = process.env.BROWSER || (provider.name !== 'playwright' ? 'chromium' : 'chrome')

const devInstances: BrowserInstanceOption[] = [
  { browser },
]

const playwrightInstances: BrowserInstanceOption[] = [
  { browser: 'chromium' },
  { browser: 'firefox' },
  // hard to run webkit on some linux distributions
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
