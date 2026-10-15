import { test } from 'vitest'
import { page } from 'vitest/browser'

test('screenshot blocked', async () => {
  await page.screenshot({ path: 'out.png' })
})
