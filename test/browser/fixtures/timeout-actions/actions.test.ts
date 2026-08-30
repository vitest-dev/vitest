import { it } from 'vitest'
import { page } from 'vitest/browser'

it('reports the action error when it arrives inside the grace', async () => {
  await page.screenshot({ path: 'delay-200.png' })
}, 500)

it('names the pending action when it does not report back', async () => {
  await page.screenshot({ path: 'delay-2000.png' })
}, 500)

it('does not wait for an action due after the test', async () => {
  await page.screenshot({ path: 'delay-2000.png', timeout: 5000 })
}, 500)
