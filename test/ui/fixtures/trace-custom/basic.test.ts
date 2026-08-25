import { chromium } from 'playwright'
import { onTestFinished, test } from 'vitest'
import { createTraceRecorder } from './trace'

test('custom trace', async ({ task }) => {
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())

  const page = await browser.newPage()
  await page.setContent('<main><button>Before action</button></main>')
  const trace = await createTraceRecorder(page, task)

  await trace.snapshot('before action')

  await page.locator('main').evaluate((element) => {
    element.innerHTML = '<button>After action</button>'
  })
  await trace.snapshot('after action')
})
