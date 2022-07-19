import { afterAll, beforeAll, describe, test } from 'vitest'
import { preview } from 'vite'
import type { PreviewServer } from 'vite'
import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { expect } from '@playwright/test'

describe('basic', async () => {
  let server: PreviewServer
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    server = await preview({ preview: { port: 3000 } })
    browser = await chromium.launch()
    page = await browser.newPage()
  })

  afterAll(async () => {
    await browser.close()
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close(error => error ? reject(error) : resolve())
    })
  })

  test('should have the correct title', async () => {
    await page.goto('http://localhost:3000')
    const button = page.locator('#btn')
    await expect(button).toBeDefined()

    await expect(button).toHaveText('Clicked 0 time(s)')

    await button.click()
    await expect(button).toHaveText('Clicked 1 time(s)')
  }, 60_000)
})
