import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { preview } from 'vite'
import type { PreviewServer } from 'vite'
import puppeteer from 'puppeteer'
import type { Browser, Page } from 'puppeteer'

describe('basic', async () => {
  let server: PreviewServer
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    server = await preview({ preview: { port: 3000 } })
    browser = await puppeteer.launch()
    page = await browser.newPage()
  })

  afterAll(async () => {
    await browser.close()
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close(error => error ? reject(error) : resolve())
    })
  })

  // TODO make more stable
  test.skip('should have the correct title', async () => {
    try {
      await page.goto('http://localhost:3000')
      const button = (await page.$('#btn'))!
      expect(button).toBeDefined()

      let text = await page.evaluate(btn => btn.textContent, button)
      expect(text).toBe('Clicked 0 time(s)')

      await button.click()
      text = await page.evaluate(btn => btn.textContent, button)
    }
    catch (e) {
      console.error(e)
      expect(e).toBeUndefined()
    }
  }, 60_000)
})
