import type { BrowserInstanceOption } from 'vitest/node'

export const provider = process.env.PROVIDER || 'playwright'
export const browser = process.env.BROWSER || (provider !== 'playwright' ? 'chromium' : 'chrome')

const devInstances: BrowserInstanceOption[] = [
  { browser },
]

const playwrightInstances: BrowserInstanceOption[] = [
  { browser: 'chromium' },
  { browser: 'firefox' },
  { browser: 'webkit' },
]

const webdriverioInstances: BrowserInstanceOption[] = [
  { browser: 'chrome' },
  { browser: 'firefox' },
]

export const instances = process.env.BROWSER
  ? devInstances
  : provider === 'playwright'
    ? playwrightInstances
    : webdriverioInstances
