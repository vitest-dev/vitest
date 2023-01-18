/* eslint-disable import/no-mutable-exports */
import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import { chromium } from 'playwright-chromium'
import type { Browser, Page } from 'playwright-chromium'
import { beforeAll } from 'vitest'

export let page!: Page
export let browser!: Browser
export const browserErrors: Error[] = []

const DIR = path.join(os.tmpdir(), 'vitest_playwright_global_setup')

beforeAll(async () => {
  const wsEndpoint = fs.readFileSync(path.join(DIR, 'wsEndpoint'), 'utf-8')
  if (!wsEndpoint)
    throw new Error('wsEndpoint not found')

  browser = await chromium.connect(wsEndpoint)
  page = await browser.newPage()

  try {
    page.on('pageerror', (error) => {
      browserErrors.push(error)
    })
  }
  catch (e) {
    await page.close()
    throw e
  }

  return async () => {
    await page?.close()
    if (browser)
      await browser.close()
  }
})
