import { remote } from 'webdriverio'
import type { Browser } from 'webdriverio'
import { isCI, isForSafari } from '../utils'
import type { ResolvedConfig } from '../types'

const cachedBrowser: Browser | null = null

export async function openBrowser(config: ResolvedConfig) {
  if (cachedBrowser)
    return cachedBrowser

  if (isForSafari(config)) {
    const safaridriver = await import('safaridriver')
    safaridriver.start({ diagnose: true })

    process.on('beforeExit', () => {
      safaridriver.stop()
    })
  }

  const browser = await remote({
    logLevel: 'error',
    capabilities: {
      'browserName': config.browser as string,
      'wdio:devtoolsOptions': { headless: config.headless ?? isCI },
    },
  })

  return browser
}

export async function openUrl(url: string, config: ResolvedConfig) {
  const browser = await openBrowser(config)

  await browser.url(url)
}
