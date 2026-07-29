import { test } from 'vitest'
import { server } from 'vitest/browser'

test('visual regression test', async ({ expect }) => {
  // reset screenshots to ensure consistent assertion results with new screenshot
  await (server.commands as any).rm(`__screenshots__`)
  await expect(expect(document.body).toMatchScreenshot()).rejects.toThrow(
    'No existing reference screenshot found',
  )
})
