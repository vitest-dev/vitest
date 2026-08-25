import { chromium } from 'playwright'
import { onTestFinished, test } from 'vitest'

let attemptIndex = 0

test('custom trace attempts', { retry: 1, repeats: 1 }, async ({ trace }) => {
  const currentAttempt = attemptIndex++
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())

  const page = await browser.newPage()
  await page.setContent(`<main>Attempt ${currentAttempt}</main>`)
  const recorder = await trace(page)
  await recorder.snapshot('attempt')

  if (currentAttempt % 2 === 0) {
    throw new Error('Retry this attempt')
  }
})
