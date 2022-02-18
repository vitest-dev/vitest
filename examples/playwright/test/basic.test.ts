import type { AddressInfo } from 'net'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { preview } from 'vite'
import type { PreviewServer } from 'vite'
import * as playwright from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'

const BROWSER = (process.env.BROWSER as 'chromium' | 'firefox' | 'webkit' | undefined) || 'chromium'

describe('basic', async() => {
  let server: PreviewServer
  let browser: Browser
  let context: BrowserContext
  let page: Page

  beforeAll(async() => {
    server = await preview({ preview: { port: 3000 } })
    // Might be a different one if port 3000 is already in use.
    const port = (server.httpServer.address() as AddressInfo).port
    browser = await playwright[BROWSER].launch()
    context = await browser.newContext({
      baseURL: `http://localhost:${port}`,
    })
    page = await context.newPage()
  })

  afterAll(async() => {
    await browser.close()
    await server.httpServer.close()
  })

  test('should have the correct title', async() => {
    await page.goto('/')

    const btn = page.locator('#btn')
    await btn.waitFor()

    expect(await btn.textContent()).toBe('Clicked 0 time(s)')
    await btn.click()
    expect(await btn.textContent()).toBe('Clicked 1 time(s)')
  }, 60_000)
})
