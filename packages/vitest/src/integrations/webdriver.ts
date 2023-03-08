import { remote } from 'webdriverio'
import type { Browser } from 'webdriverio'
import type { ResolvedConfig } from '../types'

const cachedBrowser: Browser | null = null

export async function openBrowser(config: ResolvedConfig) {
  if (cachedBrowser)
    return cachedBrowser

  const browser = await remote({
    capabilities: {
      'browserName': config.browser as string,
      'wdio:devtoolsOptions': { headless: config.headless || !!process.env.CI },
    },
  })

  return browser
}

export async function openUrl(url: string, config: ResolvedConfig) {
  const browser = await openBrowser(config)

  await browser.url(url)
}
