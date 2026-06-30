import { page } from '@vitest/browser/context'
import { test } from 'vitest'

test('screenshot denied path', async () => {
  // write is allowed, but the target is denied via `server.fs.deny`
  await page.screenshot({ path: 'my-secret.png' })
})
