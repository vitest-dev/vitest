import { test } from 'vitest'
import { page } from 'vitest/browser'

test('screenshot denied path', async () => {
  // write is allowed, but the target is denied via `server.fs.deny`
  await page.screenshot({ path: 'my-secret.txt', save: true })
})
