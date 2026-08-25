import { chromium } from 'playwright'
import { onTestFinished, test } from 'vitest'

test('custom trace', async ({ trace }) => {
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())

  const page = await browser.newPage()
  await page.setContent('<main><button>Before action</button></main>')
  const recorder = await trace(page)

  await recorder.snapshot('before action')

  await page.locator('main').evaluate((element) => {
    element.innerHTML = '<button>After action</button>'
  })
  await recorder.snapshot('after action')
})
