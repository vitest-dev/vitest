import type { Browser } from 'puppeteer'
import type { ResolvedConfig } from '../types'

let cachedBrowser: Browser | null = null

export async function openBrowser(config: ResolvedConfig) {
  if (cachedBrowser)
    return cachedBrowser

  const puppeteer = await import('puppeteer')

  const browser = await puppeteer.launch({ headless: !!(config.headless ?? process.env.CI) })
  cachedBrowser = browser
  return browser
}

export async function openUrl(url: string, config: ResolvedConfig) {
  const browser = await openBrowser(config)
  const page = await browser.newPage()

  await page.goto(url)

  return page
}
