import { page } from '@vitest/browser/context'
import { test } from 'vitest'

test('screenshot blocked', async () => {
  await page.screenshot({ path: 'out.png' })
})
