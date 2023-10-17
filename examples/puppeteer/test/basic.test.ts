import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { preview } from 'vite'
import type { PreviewServer } from 'vite'
import { launch } from 'puppeteer'
import type { Browser, Page } from 'puppeteer'

const PORT = 3000

describe('basic', async () => {
  let server: PreviewServer
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    server = await preview({ preview: { port: PORT } })
    browser = await launch({ headless: true })
    page = await browser.newPage()
  })

  afterAll(async () => {
    await browser.close()
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close(error => error ? reject(error) : resolve())
    })
  })

  test('should have the correct title', async () => {
    await page.goto(`http://localhost:${PORT}`)
    const button = (await page.$<HTMLButtonElement>('#btn'))!
    expect(button).toBeDefined()

    let text = await page.evaluate(btn => btn.textContent, button)
    expect(text).toBe('Clicked 0 time(s)')

    await button.click()
    text = await page.evaluate(btn => btn.textContent, button)
    expect(text).toBe('Clicked 1 time(s)')
  }, 60_000)
})
