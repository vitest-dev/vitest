import { chromium } from 'playwright'
import { expect, onTestFinished, test } from 'vitest'

test('custom trace', async ({ trace }) => {
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())

  const page = await browser.newPage()
  await page.setContent('<main><button>Before action</button></main>')
  const recorder = await trace(page)

  await recorder.snapshot('before action')

  const result = await recorder.mark('action', async () => {
    await page.locator('main').evaluate((element) => {
      element.innerHTML = '<button>After action</button>'
    })
    return 'action result'
  }, { kind: 'action' })
  expect(result).toBe('action result')
})
