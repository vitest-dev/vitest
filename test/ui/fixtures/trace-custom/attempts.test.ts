import { test } from './trace/test'

let attemptIndex = 0

test('custom trace attempts', { retry: 1, repeats: 1 }, async ({ page, trace }) => {
  const currentAttempt = attemptIndex++

  await page.setContent(`<main>Attempt ${currentAttempt}</main>`)
  await trace.snapshot('attempt')

  if (currentAttempt % 2 === 0) {
    throw new Error('Retry this attempt')
  }
})
